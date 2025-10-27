document.addEventListener('DOMContentLoaded', () => {
    // --- Polyfill for jspdf ---
    window.es5_Promise = Promise;

    // --- ELEMENTS ---
    const contestSelect = document.getElementById('contest-select');
    const topNSelect = document.getElementById('top-n-select');
    const generateBtn = document.getElementById('generate-report-btn');
    const exportControls = document.getElementById('export-controls');
    const printBtn = document.getElementById('print-report-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const exportXlsxBtn = document.getElementById('export-xlsx-btn');
    const reportContainer = document.getElementById('report-container');

    let currentReportData = null; // Store the fetched report data

    // 1. Populate the contest dropdown on page load
    async function populateContests() {
        try {
            const contests = await apiRequest('/api/contests');
            contests.forEach(contest => {
                const option = document.createElement('option');
                option.value = contest.id;
                option.textContent = contest.name;
                contestSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load contests:', error);
        }
    }

    // 2. Main function to fetch and render the report
    async function generateReport() {
        const contestId = contestSelect.value;
        if (!contestId) {
            alert('Please select a contest.');
            return;
        }

        reportContainer.innerHTML = '<p>Generating report, please wait...</p>';
        exportControls.classList.add('hidden');
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';

        try {
            currentReportData = await apiRequest(`/api/reports/full-tabulation?contest_id=${contestId}`);
            renderReport();
            exportControls.classList.remove('hidden');
        } catch (error) {
            reportContainer.innerHTML = `<p>Error generating report: ${error.message}</p>`;
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate';
        }
    }

    function renderReport() {
        if (!currentReportData) return;
        const data = currentReportData;
        const topN = parseInt(topNSelect.value, 10);
        
        let candidatesToDisplay = [...data.candidates];
        candidatesToDisplay.sort((a, b) => {
            const scoreA = parseFloat(data.finalScores[a.id] || 0);
            const scoreB = parseFloat(data.finalScores[b.id] || 0);
            return scoreB - scoreA;
        });

        if (topN > 0) {
            candidatesToDisplay = candidatesToDisplay.slice(0, topN);
        }
        
        let html = `
            <div id="report-header">
                <h2>${data.contestName}</h2>
                <p>Full Tabulation Report - ${topN > 0 ? `Top ${topN}` : 'All Candidates'}</p>
                <p>Generated on: ${data.generatedDate}</p>
            </div>
        `;

        data.segments.forEach(segment => {
            const criteriaForSegment = data.criteria.filter(c => c.segment_id === segment.id);

            let candidatesWithSegmentScores = candidatesToDisplay.map(candidate => {
                let segmentScore = -1; 
                if (segment.type === 'admin') {
                    const scoreKey = `${candidate.id}:${segment.id}`;
                    if (data.adminScoresMap[scoreKey] !== undefined) {
                        segmentScore = parseFloat(data.adminScoresMap[scoreKey]);
                    }
                } else if (segment.type === 'judge' && criteriaForSegment.length > 0) {
                    let calculatedSegmentScore = 0;
                    criteriaForSegment.forEach(criterion => {
                        let totalScore = 0;
                        let judgeCount = 0;
                        data.judges.forEach(judge => {
                            const scoreKey = `${judge.id}:${candidate.id}:${criterion.id}`;
                            const score = data.scoresMap[scoreKey];
                            if (score !== undefined) {
                                totalScore += parseFloat(score);
                                judgeCount++;
                            }
                        });
                        const averageScore = judgeCount > 0 ? (totalScore / judgeCount) : 0;
                        calculatedSegmentScore += averageScore;
                    });
                    segmentScore = calculatedSegmentScore;
                }
                return { candidate, segmentScore };
            });

            candidatesWithSegmentScores.sort((a, b) => {
                if (b.segmentScore !== a.segmentScore) return b.segmentScore - a.segmentScore;
                if (a.candidate.candidate_number !== b.candidate.candidate_number) return a.candidate.candidate_number - b.candidate.candidate_number;
                return a.candidate.name.localeCompare(b.candidate.name);
            });
            
            if (segment.type === 'admin') {
                html += `<table class="report-table">`;
                html += `<thead>
                    <tr>
                        <th class="segment-header" colspan="3">${segment.name} (${segment.percentage}%)</th>
                    </tr>
                    <tr>
                        <th>Candidate</th>
                        <th>Name</th>
                        <th>Score</th>
                    </tr>
                </thead>`;
                html += `<tbody>`;
                candidatesWithSegmentScores.forEach(item => {
                    const score = item.segmentScore >= 0 ? item.segmentScore.toFixed(2) : '-';
                    html += `<tr>
                        <td>#${item.candidate.candidate_number}</td>
                        <td>${item.candidate.name}</td>
                        <td>${score}</td>
                    </tr>`;
                });
                html += `</tbody></table>`;
                html += `<br>`;
                html += `<br>`;
                html += `<br>`;
                html += `<br>`;
            }
            else if (segment.type === 'judge' && criteriaForSegment.length > 0) {
                html += `<table class="report-table">`;
                html += `<thead>
                    <tr>
                        <th class="segment-header" colspan="${3 + criteriaForSegment.length}">${segment.name} (${segment.percentage}%)</th>
                    </tr>
                    <tr>
                        <th>Candidate</th>
                        <th>Name</th>
                        ${criteriaForSegment.map(c => `<th>${c.name} (${c.max_score}%)</th>`).join('')}
                        <th>Total</th>
                    </tr>
                </thead>`;
                html += `<tbody>`;
                candidatesWithSegmentScores.forEach(item => {
                    const { candidate, segmentScore } = item;
                    html += `<tr>
                        <td>#${candidate.candidate_number}</td>
                        <td>${candidate.name}</td>`;
                    
                    criteriaForSegment.forEach(criterion => {
                        let totalScore = 0;
                        let judgeCount = 0;
                        data.judges.forEach(judge => {
                            const scoreKey = `${judge.id}:${candidate.id}:${criterion.id}`;
                            const score = data.scoresMap[scoreKey];
                            if (score !== undefined) {
                                totalScore += parseFloat(score);
                                judgeCount++;
                            }
                        });
                        const averageScore = judgeCount > 0 ? (totalScore / judgeCount).toFixed(2) : '-';
                        html += `<td>${averageScore}</td>`;
                    });
                    
                    html += `<td><strong>${segmentScore >= 0 ? segmentScore.toFixed(2) : '-'}</strong></td>`;
                    html += `</tr>`;
                });
                html += `</tbody></table>`;
                html += `<br>`;
            }
        });

        html += `<table class="report-table">
            <thead>
                <tr><th class="segment-header" colspan="3">Final Ranking</th></tr>
                <tr><th>Rank</th><th>Candidate</th><th>Final Score</th></tr>
            </thead>
            <tbody>`;
        
        candidatesToDisplay.forEach((candidate, index) => {
            const finalScore = data.finalScores[candidate.id] || '0.00';
            html += `<tr>
                <td>${index + 1}</td>
                <td>#${candidate.candidate_number} - ${candidate.name}</td>
                <td><strong>${finalScore}</strong></td>
            </tr>`;
        });

        html += `</tbody></table>`;
        reportContainer.innerHTML = html;
    }
    
    function exportToXLSX() {
        if (!currentReportData) {
            alert("Please generate a report first.");
            return;
        }
        const data = currentReportData;
        const topN = parseInt(topNSelect.value, 10);
        const fileName = `${data.contestName.replace(/ /g, '_')}_Report_${topN > 0 ? `Top${topN}` : 'All'}.xlsx`;

        const wb = XLSX.utils.book_new();
        const ws_data = [];
        
        let candidatesToDisplay = [...data.candidates].sort((a, b) => (data.finalScores[b.id] || 0) - (data.finalScores[a.id] || 0));
        if (topN > 0) candidatesToDisplay = candidatesToDisplay.slice(0, topN);

        ws_data.push([data.contestName + " Full Tabulation"]);
        ws_data.push([`Generated on: ${data.generatedDate}`]);
        ws_data.push([]);

        data.segments.forEach(segment => {
            const criteriaForSegment = data.criteria.filter(c => c.segment_id === segment.id);
            
            let candidatesWithSegmentScores = candidatesToDisplay.map(candidate => {
                let segmentScore = -1;
                if (segment.type === 'admin') {
                    const scoreKey = `${candidate.id}:${segment.id}`;
                    if (data.adminScoresMap[scoreKey] !== undefined) {
                        segmentScore = parseFloat(data.adminScoresMap[scoreKey]);
                    }
                } else if (segment.type === 'judge' && criteriaForSegment.length > 0) {
                    let calculatedSegmentScore = 0;
                    criteriaForSegment.forEach(criterion => {
                        let total = 0, count = 0;
                        data.judges.forEach(judge => {
                            const score = data.scoresMap[`${judge.id}:${candidate.id}:${criterion.id}`];
                            if(score !== undefined) { total += score; count++; }
                        });
                        const averageScore = count > 0 ? (total / count) : 0;
                        calculatedSegmentScore += averageScore;
                    });
                    segmentScore = calculatedSegmentScore;
                }
                return { candidate, segmentScore };
            });

            candidatesWithSegmentScores.sort((a, b) => {
                if (b.segmentScore !== a.segmentScore) return b.segmentScore - a.segmentScore;
                if (a.candidate.candidate_number !== b.candidate.candidate_number) return a.candidate.candidate_number - b.candidate.candidate_number;
                return a.candidate.name.localeCompare(b.candidate.name);
            });
            
            if (segment.type === 'admin') {
                ws_data.push([`${segment.name} (${segment.percentage}%)`]);
                ws_data.push(["#", "Candidate Name", "Score"]);
                candidatesWithSegmentScores.forEach(item => {
                    const score = item.segmentScore >= 0 ? item.segmentScore.toFixed(2) : '';
                    ws_data.push([item.candidate.candidate_number, item.candidate.name, score]);
                });
                ws_data.push([]);
            } else if (segment.type === 'judge' && criteriaForSegment.length > 0) {
                ws_data.push([`${segment.name} (${segment.percentage}%)`]);
                const headerRow = ["#", "Candidate Name", ...criteriaForSegment.map(c => `${c.name} (${c.max_score}%)`), 'Total'];
                ws_data.push(headerRow);

                candidatesWithSegmentScores.forEach(item => {
                    const { candidate, segmentScore } = item;
                    const row = [candidate.candidate_number, candidate.name];
                    criteriaForSegment.forEach(criterion => {
                        let total = 0, count = 0;
                        data.judges.forEach(judge => {
                            const score = data.scoresMap[`${judge.id}:${candidate.id}:${criterion.id}`];
                            if(score !== undefined) { total += score; count++; }
                        });
                        row.push(count > 0 ? (total / count).toFixed(2) : '');
                    });
                    row.push(segmentScore >= 0 ? segmentScore.toFixed(2) : '');
                    ws_data.push(row);
                });
                ws_data.push([]);
            }
        });

        ws_data.push([]);
        ws_data.push(["Final Ranking"]);
        ws_data.push(["Rank", "Candidate", "Final Score"]);
        candidatesToDisplay.forEach((c, i) => {
            ws_data.push([i + 1, `#${c.candidate_number} ${c.name}`, data.finalScores[c.id] || '0.00']);
        });

        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        XLSX.utils.book_append_sheet(wb, ws, "Tabulation");
        XLSX.writeFile(wb, fileName);
    }

    // 5. (REWRITTEN) EXPORT TO PDF WITH PAGINATION
    function exportToPDF() {
        if (!currentReportData) {
            alert("Please generate a report first.");
            return;
        }
        exportPdfBtn.textContent = 'Generating...';
        exportPdfBtn.disabled = true;

        const { jsPDF } = window.jspdf;
        const reportElement = document.getElementById('report-container');

        // Add the print-friendly class to the body
        document.body.classList.add('pdf-export-mode');

        html2canvas(reportElement, {
            scale: 2, // Higher scale for better quality
            logging: false,
            useCORS: true
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'pt', // Use points for standard sizing
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            // Calculate the ratio to fit the canvas image to the PDF's width
            const ratio = canvasWidth / pdfWidth;
            const scaledCanvasHeight = canvasHeight / ratio;

            let heightLeft = scaledCanvasHeight;
            let position = 0;

            // Add the first page
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledCanvasHeight);
            heightLeft -= pdfHeight;

            // Loop to add new pages if the content is taller than one page
            while (heightLeft > 0) {
                position -= pdfHeight; // Move the image "up" to show the next part
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledCanvasHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`${currentReportData.contestName.replace(/ /g, '_')}_Report.pdf`);

        }).finally(() => {
            // CRUCIAL: Always remove the class afterwards
            document.body.classList.remove('pdf-export-mode');
            exportPdfBtn.textContent = 'Export as PDF';
            exportPdfBtn.disabled = false;
        });
    }

    // 6. Event Listeners
    generateBtn.addEventListener('click', generateReport);
    topNSelect.addEventListener('change', renderReport); // Re-render when filter changes
    
    printBtn.addEventListener('click', () => window.print());
    exportXlsxBtn.addEventListener('click', exportToXLSX);
    exportPdfBtn.addEventListener('click', exportToPDF);

    // --- INITIALIZATION ---
    populateContests();
});