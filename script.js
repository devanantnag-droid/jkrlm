   const API_URL = "https://script.google.com/macros/s/AKfycbz_5DsA0De7Bt1vWWuQSSOS4DONuZNS1Sgp7PuaICZ3utOBNWU1OKol7-Q0sM4nSVon/exec";

        let session = { role: "", blockName: "" };
        let availableMetrics = [];
        let blockHeaderMapping = {}; 
        let globalCachedDashboardData = null; 
        let temporaryDraftCache = {};

        function triggerPopupModal(title, msg, statusType = "success") {
            const modal = document.getElementById("popup-modal");
            const box = document.getElementById("modal-box");
            const wrapper = document.getElementById("modal-icon-wrapper");
            const iconSuccess = document.getElementById("modal-icon-success");
            const iconError = document.getElementById("modal-icon-error");

            document.getElementById("modal-title").innerText = title;
            document.getElementById("modal-message").innerText = msg;

            if (statusType === "success") {
                wrapper.className = "mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 bg-emerald-100 text-emerald-600";
                iconSuccess.classList.remove("hidden");
                iconError.classList.add("hidden");
            } else {
                wrapper.className = "mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 bg-red-100 text-red-600";
                iconError.classList.remove("hidden");
                iconSuccess.classList.add("hidden");
            }

            modal.classList.remove("hidden");
            setTimeout(() => {
                modal.classList.remove("opacity-0");
                box.classList.remove("scale-95");
            }, 10);
        }

        function closePopupModal() {
            const modal = document.getElementById("popup-modal");
            const box = document.getElementById("modal-box");

            modal.classList.add("opacity-0");
            box.classList.add("scale-95");
            setTimeout(() => {
                modal.classList.add("hidden");
            }, 300);
        }

        window.addEventListener("DOMContentLoaded", () => {
            const savedRole = sessionStorage.getItem("portal_role");
            const savedBlock = sessionStorage.getItem("portal_block");

            if (savedRole) {
                session.role = savedRole;
                session.blockName = savedBlock || "";

                if (session.role === "ADMIN") {
                    showView("admin-view");
                    document.getElementById("admin-dashboard-date").value = new Date().toISOString().split('T')[0];
                    loadAdminDashboard();
                } else {
                    showView("block-view");
                    document.getElementById("user-block-title").innerText = session.blockName;
                    document.getElementById("submission-date").value = new Date().toISOString().split('T')[0];
                    loadBlockForm();
                }
            } else {
                showView("login-view");
            }
        });

        function showView(viewId) {
            document.getElementById("login-view").classList.add("hidden");
            document.getElementById("block-view").classList.add("hidden");
            document.getElementById("admin-view").classList.add("hidden");
            document.getElementById(viewId).classList.remove("hidden");
        }

        async function handleLogin() {
            const user = document.getElementById("username").value;
            const pass = document.getElementById("password").value;
            const errorElement = document.getElementById("login-error");
            const loginBtn = document.getElementById("login-btn");

            if (!user || !pass) {
                errorElement.innerText = "Please fill out all fields.";
                errorElement.classList.remove("hidden");
                return;
            }

            errorElement.classList.add("hidden");
            loginBtn.innerText = "Signing In...";
            loginBtn.disabled = true;

            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    mode: "cors",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "login", username: user, password: pass })
                });

                const result = await response.json();

                if (result && result.success) {
                    session.role = result.role;
                    session.blockName = result.blockName || "";
                    
                    sessionStorage.setItem("portal_role", session.role);
                    sessionStorage.setItem("portal_block", session.blockName);

                    if (session.role === "ADMIN") {
                        showView("admin-view");
                        document.getElementById("admin-dashboard-date").value = new Date().toISOString().split('T')[0];
                        loadAdminDashboard();
                    } else {
                        showView("block-view");
                        document.getElementById("user-block-title").innerText = session.blockName;
                        document.getElementById("submission-date").value = new Date().toISOString().split('T')[0];
                        loadBlockForm();
                    }
                } else {
                    errorElement.innerText = result.message || "Invalid credentials";
                    errorElement.classList.remove("hidden");
                }
            } catch (err) {
                errorElement.innerText = "Connection Error: Deployment mismatch.";
                errorElement.classList.remove("hidden");
                console.error(err);
            } finally {
                loginBtn.innerText = "Sign In to System";
                loginBtn.disabled = false;
            }
        }

        async function loadBlockForm() {
            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    mode: "cors",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "getAdminDashboard" })
                });
                globalCachedDashboardData = await response.json();
                
                if (globalCachedDashboardData && globalCachedDashboardData.success) {
                    availableMetrics = globalCachedDashboardData.metrics.slice(1); 
                    
                    const headers = globalCachedDashboardData.metrics[0];
                    blockHeaderMapping = {};
                    for(let i = 3; i < headers.length; i++) {
                        if(headers[i]) {
                            blockHeaderMapping[headers[i].toString().trim().toUpperCase()] = i;
                        }
                    }

                    document.getElementById("block-loading").classList.add("hidden");
                    renderBlockFormLayout();
                    calculateBlockDashboard();
                }
            } catch (err) {
                document.getElementById("block-loading").innerText = "Error loading metric fields.";
                console.error(err);
            }
        }

        function cacheInputDraft(metricId, rawValue) {
            temporaryDraftCache[metricId] = rawValue;
        }

        function handleBlockDateChange() {
            temporaryDraftCache = {}; 
            calculateBlockDashboard();
            renderBlockFormLayout();
        }

        function renderBlockFormLayout() {
            if (!globalCachedDashboardData) return;

            const headers = globalCachedDashboardData.metrics[0];
            const achievements = globalCachedDashboardData.achievements.slice(1);
            const currentBlockUpper = session.blockName.toUpperCase().trim();
            const layoutType = document.getElementById("block-layout-filter").value;
            const selectedDateStr = document.getElementById("submission-date").value;

            let targetColumnIdx = -1;
            for(let i = 3; i < headers.length; i++) {
                if(headers[i] && headers[i].toString().toUpperCase().trim() === currentBlockUpper) {
                    targetColumnIdx = i;
                    break;
                }
            }
            if(targetColumnIdx === -1) targetColumnIdx = 3;

            const tableContainer = document.getElementById("block-table-container");
            const cardsContainer = document.getElementById("block-cards-container");
            const submitBtn = document.getElementById("submit-btn");

            if (layoutType === "TABLE") {
                cardsContainer.classList.add("hidden");
                tableContainer.classList.remove("hidden");
                submitBtn.classList.remove("hidden"); 
                
                const tbody = document.getElementById("block-table-body");
                tbody.innerHTML = "";

                availableMetrics.forEach(row => {
                    if(row[0] && row[1]) {
                        let assignedTarget = parseInt(row[targetColumnIdx]) || 0;
                        let preservedValue = temporaryDraftCache[row[0]] !== undefined ? temporaryDraftCache[row[0]] : "";

                        tbody.innerHTML += `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="p-4 font-medium text-slate-900 max-w-md">${row[1]}</td>
                                <td class="p-4"><span class="px-2 py-0.5 rounded text-xs bg-slate-100 font-medium">${row[2] || 'General'}</span></td>
                                <td class="p-4 text-center">
                                    <span class="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-mono font-bold border border-red-100 rounded-md">${assignedTarget}</span>
                                </td>
                                <td class="p-4 text-center max-w-[140px]">
                                    <input type="number" 
                                           data-id="${row[0]}" 
                                           value="${preservedValue}" 
                                           oninput="cacheInputDraft('${row[0]}', this.value)"
                                           placeholder="Provide metric value" 
                                           class="metric-input border border-slate-200 p-2 rounded-lg bg-white w-full text-center shadow-sm font-mono font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                                </td>
                            </tr>
                        `;
                    }
                });
            } else {
                tableContainer.classList.add("hidden");
                submitBtn.classList.add("hidden"); 
                cardsContainer.classList.remove("hidden");
                cardsContainer.innerHTML = "";

                availableMetrics.forEach(row => {
                    if(row[0] && row[1]) {
                        let assignedTarget = parseInt(row[targetColumnIdx]) || 0;
                        let dynamicCumulativeSum = 0;
                        let dynamicDailySum = 0;

                        achievements.forEach(a => {
                            let recordBlockUpper = a[2] ? a[2].toString().trim().toUpperCase() : "";
                            let recordMetricId = a[3] ? a[3].toString().trim() : "";
                            let recordRawDate = a[1] ? a[1].toString().split("T")[0] : "";
                            let value = parseInt(a[4]) || 0;

                            if (recordBlockUpper === currentBlockUpper && recordMetricId === row[0]) {
                                dynamicCumulativeSum += value;
                                if (recordRawDate === selectedDateStr) {
                                    dynamicDailySum += value;
                                }
                            }
                        });

                        cardsContainer.innerHTML += `
                            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition flex flex-col justify-between">
                                <div>
                                    <div class="flex justify-between items-center gap-2 mb-2">
                                        <span class="px-2 py-0.5 text-[10px] bg-slate-100 font-bold text-slate-500 rounded uppercase tracking-wider">${row[2] || 'General'}</span>
                                        <span class="text-xs font-semibold text-slate-400 font-mono">ID: ${row[0]}</span>
                                    </div>
                                    <h4 class="text-sm font-bold text-slate-800 tracking-tight leading-snug">${row[1]}</h4>
                                </div>
                                
                                <div class="grid grid-cols-3 gap-2 border-t border-slate-100 mt-4 pt-4 text-center">
                                    <div class="bg-red-50/40 p-2 rounded-xl border border-red-100/50">
                                        <p class="text-[9px] font-bold text-red-500 uppercase tracking-tight">Target</p>
                                        <p class="text-base font-black text-red-600 font-mono mt-0.5">${assignedTarget}</p>
                                    </div>
                                    <div class="bg-amber-50/40 p-2 rounded-xl border border-amber-100/50">
                                        <p class="text-[9px] font-bold text-amber-500 uppercase tracking-tight">Daily</p>
                                        <p class="text-base font-black text-amber-600 font-mono mt-0.5">${dynamicDailySum}</p>
                                    </div>
                                    <div class="bg-blue-50/40 p-2 rounded-xl border border-blue-100/50">
                                        <p class="text-[9px] font-bold text-blue-500 uppercase tracking-tight">Total</p>
                                        <p class="text-base font-black text-blue-600 font-mono mt-0.5">${dynamicCumulativeSum}</p>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                });
            }
        }

        function calculateBlockDashboard() {
            if (!globalCachedDashboardData) return;

            const headers = globalCachedDashboardData.metrics[0];
            const metrics = globalCachedDashboardData.metrics.slice(1);
            const achievements = globalCachedDashboardData.achievements.slice(1);
            const selectedDateStr = document.getElementById("submission-date").value;
            const currentBlockUpper = session.blockName.toUpperCase().trim();

            let targetColumnIdx = -1;
            for(let i = 3; i < headers.length; i++) {
                if(headers[i] && headers[i].toString().toUpperCase().trim() === currentBlockUpper) {
                    targetColumnIdx = i;
                    break;
                }
            }
            if(targetColumnIdx === -1) targetColumnIdx = 3;

            let blockTargetsSum = 0;
            let blockDailySum = 0;
            let blockCumulativeSum = 0;

            metrics.forEach(row => {
                if(row[0]) blockTargetsSum += (parseInt(row[targetColumnIdx]) || 0);
            });

            achievements.forEach(a => {
                let recordBlockUpper = a[2] ? a[2].toString().trim().toUpperCase() : "";
                let recordRawDate = a[1] ? a[1].toString().split("T")[0] : "";
                let value = parseInt(a[4]) || 0;

                if (recordBlockUpper === currentBlockUpper) {
                    blockCumulativeSum += value;
                    if (recordRawDate === selectedDateStr) {
                        blockDailySum += value;
                    }
                }
            });

            document.getElementById("block-card-target").innerText = blockTargetsSum;
            document.getElementById("block-card-daily").innerText = blockDailySum;
            document.getElementById("block-card-total").innerText = blockCumulativeSum;
            document.getElementById("block-summary-cards").classList.remove("hidden");
        }

        async function submitBlockData() {
            const dateValue = document.getElementById("submission-date").value;
            const submitBtn = document.getElementById("submit-btn");
            const inputs = document.querySelectorAll(".metric-input");
            
            let records = [];
            let formHasBlankInputs = false;

            inputs.forEach(input => {
                const inputValueRaw = input.value.trim();
                
                if (inputValueRaw === "") {
                    formHasBlankInputs = true;
                    input.classList.add("border-red-500", "focus:ring-red-500", "focus:border-red-500");
                } else {
                    input.classList.remove("border-red-500", "focus:ring-red-500", "focus:border-red-500");
                }

                records.push({
                    metricId: input.getAttribute("data-id"),
                    value: inputValueRaw || 0
                });
            });

            if (formHasBlankInputs) {
                triggerPopupModal(
                    "Missing Information", 
                    "Please fill in a value (enter 0 if there is no achievement) for highlighted rows before submitting.", 
                    "error"
                );
                return;
            }

            submitBtn.innerText = "Syncing Data...";
            submitBtn.disabled = true;
            inputs.forEach(i => i.disabled = true);

            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    mode: "cors",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        action: "submitProgress",
                        blockName: session.blockName,
                        date: dateValue,
                        records: records
                    })
                });

                const res = await response.json();
                if(res && res.success) {
                    triggerPopupModal("Saved Successfully", "Data Submitted in the DataBase!", "success");
                    temporaryDraftCache = {}; 
                    loadBlockForm();
                } else {
                    triggerPopupModal("Submission Failed", res.message || "Unknown server response", "error");
                }
            } catch (err) {
                triggerPopupModal("Network Error", "Network error updating rows. Please try again.", "error");
                console.error(err);
            } finally {
                submitBtn.innerText = "Authenticate Your Data";
                submitBtn.disabled = false;
                inputs.forEach(i => i.disabled = false);
            }
        }

        function exportBlockDataToExcel() {
            if(!globalCachedDashboardData) {
                triggerPopupModal("Download Aborted", "Matrix records cache not completely compiled yet.", "error");
                return;
            }
            
            const targetBlockName = session.blockName;
            const targetBlockUpper = targetBlockName.toUpperCase().trim();
            const selectedDate = document.getElementById("submission-date").value;
            const filename = `Progress_Report_${targetBlockUpper}_${selectedDate}.xlsx`;
            
            let workbook = XLSX.utils.book_new();
            let dataRows = [["Metric ID", "Parameter Metric Description", "Domain Classification", "Target Assigned", "Selected Date Value", "Cumulative Progress Total"]];
            
            const metrics = globalCachedDashboardData.metrics.slice(1);
            const achievements = globalCachedDashboardData.achievements.slice(1);
            
            let colIdx = blockHeaderMapping[targetBlockUpper];
            
            metrics.forEach(m => {
                if(!m[0]) return;
                let assignedTarget = (colIdx !== undefined) ? (parseInt(m[colIdx]) || 0) : 0;
                let cumulativeSum = 0;
                let dailySum = 0;
                
                achievements.forEach(a => {
                    if(a[3] === m[0] && a[2].toString().toUpperCase().trim() === targetBlockUpper) {
                        let val = parseInt(a[4]) || 0;
                        cumulativeSum += val;
                        if(a[1].toString().split("T")[0] === selectedDate) {
                            dailySum += val;
                        }
                    }
                });
                dataRows.push([m[0], m[1], m[2] || 'General', assignedTarget, dailySum, cumulativeSum]);
            });
            
            let worksheet = XLSX.utils.aoa_to_sheet(dataRows);
			const autoWidth = dataRows.reduce((widths, row) => {
    row.forEach((cell, i) => {
        const cellLength = cell ? cell.toString().length : 0;
        widths[i] = Math.max(widths[i] || 10, cellLength);
    });
    return widths;
}, []);

worksheet["!cols"] = autoWidth.map(width => ({
    wch: width + 3
}));
            XLSX.utils.book_append_sheet(workbook, worksheet, `${targetBlockName} Metrics`);
            XLSX.writeFile(workbook, filename);

        }

        async function loadAdminDashboard() {
            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    mode: "cors",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "getAdminDashboard" })
                });
                globalCachedDashboardData = await response.json();
                
                if (globalCachedDashboardData && globalCachedDashboardData.success) {
                    const headers = globalCachedDashboardData.metrics[0];
                    blockHeaderMapping = {};
                    
                    const filterDropdown = document.getElementById("admin-block-filter");
                    const previousSelection = filterDropdown.value || "ALL"; 
                    
                    filterDropdown.innerHTML = '<option value="ALL">All Blocks Combined</option>';
                    let blocksDetectedSet = new Set();

                    for(let i = 3; i < headers.length; i++) {
                        if(headers[i]) {
                            let cleanBlockName = headers[i].toString().trim().toUpperCase();
                            blockHeaderMapping[cleanBlockName] = i;
                            blocksDetectedSet.add(cleanBlockName);
                        }
                    }

                    const achievements = globalCachedDashboardData.achievements.slice(1);
                    achievements.forEach(a => {
                        let bName = a[2] ? a[2].toString().trim().toUpperCase() : "";
                        if(bName) blocksDetectedSet.add(bName);
                    });

                    Array.from(blocksDetectedSet).sort().forEach(blockName => {
                        filterDropdown.innerHTML += `<option value="${blockName}">${blockName}</option>`;
                    });

                    if (blocksDetectedSet.has(previousSelection) || previousSelection === "ALL") {
                        filterDropdown.value = previousSelection;
                    }

                    renderAdminUI();
                }
            } catch (err) {
                document.getElementById("admin-loading").innerText = "Failed to compile live dashboard data.";
                console.error(err);
            }
        }

        async function refreshAdminData() {
            const refreshBtn = document.getElementById("refresh-btn");
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"></path></svg>
                Syncing Matrix...
            `;

            await loadAdminDashboard();

            refreshBtn.disabled = false;
            refreshBtn.innerHTML = `
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"></path></svg>
                Refresh Data
            `;
        }

        function renderAdminUI() {
            if(!globalCachedDashboardData) return;

            const metrics = globalCachedDashboardData.metrics.slice(1);
            const achievements = globalCachedDashboardData.achievements.slice(1);
            const selectedDateStr = document.getElementById("admin-dashboard-date").value; 
            const selectedBlockFilter = document.getElementById("admin-block-filter").value; 

            let processingBlocks = [];
            if(selectedBlockFilter === "ALL") {
                processingBlocks = Object.keys(blockHeaderMapping);
                if(processingBlocks.length === 0) {
                    let fallbackSet = new Set();
                    achievements.forEach(a => { if(a[2]) fallbackSet.add(a[2].toString().toUpperCase().trim()); });
                    processingBlocks = Array.from(fallbackSet);
                }
            } else {
                processingBlocks = [selectedBlockFilter];
            }
            processingBlocks.sort();

            let totalDistrictTarget = 0;
            let cumulativeDistrictAchvt = 0;
            let dailyTotalEntriesCount = 0;
            let dailyTotalAchvtSum = 0;
            let checkDailySet = new Set();

            metrics.forEach(m => {
                if(!m[0]) return;
                processingBlocks.forEach(block => {
                    let colIdx = blockHeaderMapping[block];
                    if(colIdx !== undefined) {
                        totalDistrictTarget += (parseInt(m[colIdx]) || 0);
                    }
                });
            });

            achievements.forEach(a => {
                let entryValue = parseInt(a[4]) || 0;
                let recordBlockUpper = a[2] ? a[2].toString().trim().toUpperCase() : "";
                let recordRawDate = a[1] ? a[1].toString().split("T")[0] : "";

                if(selectedBlockFilter === "ALL" || selectedBlockFilter === recordBlockUpper) {
                    cumulativeDistrictAchvt += entryValue;

                    if (recordRawDate === selectedDateStr) {
                        dailyTotalAchvtSum += entryValue;
                        if(entryValue > 0) {
                            let trackingKey = `${a[2]}-${a[0]}`; 
                            if(!checkDailySet.has(trackingKey)){
                                checkDailySet.add(trackingKey);
                                dailyTotalEntriesCount++;
                            }
                        }
                    }
                }
            });

            document.getElementById("card-daily-entries").innerText = dailyTotalEntriesCount;
            document.getElementById("card-daily-achvt").innerText = dailyTotalAchvtSum;
            document.getElementById("card-total-target").innerText = totalDistrictTarget;
            document.getElementById("card-total-achvt").innerText = cumulativeDistrictAchvt;

            const tableContainer = document.getElementById("admin-table-container");
            const cardsContainer = document.getElementById("admin-cards-container");
            const scrollTip = document.getElementById("admin-scroll-tip");

            if (selectedBlockFilter !== "ALL") {
                tableContainer.classList.add("hidden");
                scrollTip.classList.add("hidden");
                cardsContainer.classList.remove("hidden");
                cardsContainer.innerHTML = ""; 

                metrics.forEach(m => {
                    if(!m[0] || !m[1]) return;

                    let block = selectedBlockFilter;
                    let colIdx = blockHeaderMapping[block];
                    let targetValue = (colIdx !== undefined) ? (parseInt(m[colIdx]) || 0) : 0;

                    let cumulativeBlockSum = 0;
                    let dailyBlockSum = 0;

                    achievements.forEach(a => {
                        let currentBlock = a[2] ? a[2].toString().trim().toUpperCase() : "";
                        let currentMetric = a[3] ? a[3].toString().trim() : "";
                        let recordRawDate = a[1] ? a[1].toString().split("T")[0] : "";
                        let value = parseInt(a[4]) || 0;

                        if (currentMetric === m[0] && currentBlock === block) {
                            cumulativeBlockSum += value;
                            if (recordRawDate === selectedDateStr) {
                                dailyBlockSum += value;
                            }
                        }
                    });

                    cardsContainer.innerHTML += `
                        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition flex flex-col justify-between">
                            <div>
                                <div class="flex justify-between items-start gap-2 mb-2">
                                    <span class="px-2 py-0.5 text-[10px] bg-slate-100 font-bold text-slate-500 rounded uppercase tracking-wider">${m[2] || 'General'}</span>
                                    <span class="text-xs font-semibold text-slate-400 font-mono">ID: ${m[0]}</span>
                                </div>
                                <h4 class="text-sm font-bold text-slate-800 tracking-tight leading-snug">${m[1]}</h4>
                            </div>
                            
                            <div class="grid grid-cols-3 gap-2 border-t border-slate-100 mt-6 pt-4 text-center">
                                <div class="bg-red-50/50 p-2 rounded-xl border border-red-100/50">
                                    <p class="text-[10px] font-bold text-red-500 uppercase">Target</p>
                                    <p class="text-lg font-black text-red-600 font-mono mt-0.5">${targetValue}</p>
                                </div>
                                <div class="bg-amber-50/50 p-2 rounded-xl border border-amber-100/50">
                                    <p class="text-[10px] font-bold text-amber-600 uppercase">Daily</p>
                                    <p class="text-lg font-black text-amber-600 font-mono mt-0.5">${dailyBlockSum}</p>
                                </div>
                                <div class="bg-blue-50/50 p-2 rounded-xl border border-blue-100/50">
                                    <p class="text-[10px] font-bold text-blue-500 uppercase">Total</p>
                                    <p class="text-lg font-black text-blue-600 font-mono mt-0.5">${cumulativeBlockSum}</p>
                                </div>
                            </div>
                        </div>
                    `;
                });

            } else {
                cardsContainer.classList.add("hidden");
                tableContainer.classList.remove("hidden");
                scrollTip.classList.remove("hidden");

                const tableElement = document.getElementById("dynamic-admin-table");
                tableElement.innerHTML = "";

                let headerHtml = `
                    <thead class="sticky top-0 z-20 bg-slate-100 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                        <tr class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th class="p-4 bg-slate-100 sticky-col-1 min-w-[280px]" rowspan="2">Metric Parameter</th>
                            <th class="p-4 bg-slate-100 sticky-col-2 min-w-[140px]" rowspan="2">Domain</th>
                `;
                processingBlocks.forEach(block => {
                    headerHtml += `<th colspan="3" class="p-2 text-center border-l border-slate-200 bg-slate-100/50">${block}</th>`;
                });
                headerHtml += `</tr><tr class="text-[10px] font-bold uppercase tracking-wider bg-slate-50">`;
                
                processingBlocks.forEach(() => {
                    headerHtml += `
                        <th class="p-2 text-center border-l border-slate-200 text-red-600 font-bold">Target</th>
                        <th class="p-2 text-center text-amber-600 bg-amber-50/20">Daily</th>
                        <th class="p-2 text-center text-blue-600">Total</th>
                    `;
                });
                headerHtml += `</tr></thead>`;

                let bodyHtml = `<tbody class="divide-y divide-slate-100 text-sm">`;
                metrics.forEach(m => {
                    if(!m[0] || !m[1]) return;

                    bodyHtml += `
                        <tr class="hover:bg-slate-50/80 transition-colors">
                            <td class="p-4 font-medium text-slate-900 max-w-sm bg-white sticky-col-1 shadow-[1px_0_0_0_rgba(226,232,240,1)]">${m[1]}</td>
                            <td class="p-4 bg-white sticky-col-2 shadow-[1px_0_0_0_rgba(226,232,240,1)]"><span class="px-2 py-0.5 rounded text-xs bg-slate-100 font-medium">${m[2] || 'General'}</span></td>
                    `;

                    processingBlocks.forEach(block => {
                        let colIdx = blockHeaderMapping[block];
                        let targetValue = (colIdx !== undefined) ? (parseInt(m[colIdx]) || 0) : 0;

                        let cumulativeBlockSum = 0;
                        let dailyBlockSum = 0;

                        achievements.forEach(a => {
                            let currentBlock = a[2] ? a[2].toString().trim().toUpperCase() : "";
                            let currentMetric = a[3] ? a[3].toString().trim() : "";
                            let recordRawDate = a[1] ? a[1].toString().split("T")[0] : "";
                            let value = parseInt(a[4]) || 0;

                            if (currentMetric === m[0] && currentBlock === block) {
                                cumulativeBlockSum += value;
                                if (recordRawDate === selectedDateStr) {
                                    dailyBlockSum += value;
                                }
                            }
                        });

                        bodyHtml += `
                            <td class="p-2 text-center font-mono font-bold text-red-600 bg-red-50/40 border-l border-slate-200">${targetValue}</td>
                            <td class="p-2 text-center font-mono font-semibold text-amber-600 bg-amber-50/10">${dailyBlockSum}</td>
                            <td class="p-2 text-center font-mono font-bold text-blue-600">${cumulativeBlockSum}</td>
                        `;
                    });

                    bodyHtml += `</tr>`;
                });
                bodyHtml += `</tbody>`;

                tableElement.innerHTML = headerHtml + bodyHtml;
            }
renderRankingColumn();
            document.getElementById("admin-loading").classList.add("hidden");
            document.getElementById("admin-summary-cards").classList.remove("hidden");
			
			// Inside renderAdminUI function:
const rankingData = getDistrictWideRanking();
const rankingContainer = document.getElementById('admin-ranking-container'); // You will create this HTML

if (rankingContainer) {
    rankingContainer.innerHTML = `
        <h3 style="font-size: 14px; font-weight: bold; text-transform: uppercase; font-family: sans-serif; background: linear-gradient(90deg, #ff9900 0%, #ffea00 35%, #ffffff 50%, #ffea00 65%, #ff9900 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shine 2.5s linear infinite;">
  LIVE BLOCK PERFORMANCE
</h3>

<style>
  @keyframes shine { to { background-position: 200% center; } }
</style>

<style>
  @keyframes shine { to { background-position: 200% center; } }
</style>
<!-- Seven-colour gradient underline using Tailwind's arbitrary values -->
<div class="h-1 w-full rounded bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500"></div>
            ${rankingData.map((b, i) => `
                <div class="flex items-center justify-between py-2 border-b last:border-0">
                    <span class="text-sm font-medium text-slate-600">${i + 1}. ${b.name}</span>
                    <span class="text-sm font-black text-blue-600">${b.total.toLocaleString()}</span>
                </div>
            `).join('')}
        </div>
    `;
}
        }
		

        function exportAdminDataToExcel() {
    if (!globalCachedDashboardData) {
        triggerPopupModal("Export Failed", "Dashboard data not loaded yet.", "error");
        return;
    }

    const selectedBlock = document.getElementById("admin-block-filter").value;
    const selectedDomain = document.getElementById("admin-domain-filter").value;
    const selectedDate = document.getElementById("admin-dashboard-date").value;

    const metrics = globalCachedDashboardData.metrics.slice(1);
    const achievements = globalCachedDashboardData.achievements.slice(1);

    let workbook = XLSX.utils.book_new();

    // ==========================================
    // ALL BLOCKS COMBINED REPORT
    // ==========================================
    if (selectedBlock === "ALL") {

        let blocks = Object.keys(blockHeaderMapping).sort();

        let headerRow1 = ["Metric Parameter", "Domain"];
        let headerRow2 = ["", ""];

        blocks.forEach(block => {
            headerRow1.push(block, "", "");
            headerRow2.push("Target", "Daily", "Total");
        });

        let dataRows = [headerRow1, headerRow2];

        metrics.forEach(metric => {

            if (!metric[0] || !metric[1]) return;

            const metricDomain =
                (metric[2] || "GENERAL").toString().trim().toUpperCase();

            if (
                selectedDomain !== "ALL" &&
                metricDomain !== selectedDomain
            ) {
                return;
            }

            let row = [
                metric[1],
                metricDomain
            ];

            blocks.forEach(block => {

                const colIdx = blockHeaderMapping[block];

                let targetValue =
                    colIdx !== undefined
                        ? (parseInt(metric[colIdx]) || 0)
                        : 0;

                let dailyValue = 0;
                let totalValue = 0;

                achievements.forEach(a => {

                    const achievementBlock =
                        a[2]
                            ? a[2].toString().trim().toUpperCase()
                            : "";

                    const achievementMetric =
                        a[3]
                            ? a[3].toString().trim()
                            : "";

                    if (
                        achievementBlock === block &&
                        achievementMetric === metric[0]
                    ) {
                        const val = parseInt(a[4]) || 0;

                        totalValue += val;

                        const recordDate =
                            a[1]
                                ? a[1].toString().split("T")[0]
                                : "";

                        if (recordDate === selectedDate) {
                            dailyValue += val;
                        }
                    }
                });

                row.push(
                    targetValue,
                    dailyValue,
                    totalValue
                );
            });

            dataRows.push(row);
        });

        let worksheet = XLSX.utils.aoa_to_sheet(dataRows);
		const autoWidth = dataRows.reduce((widths, row) => {
    row.forEach((cell, i) => {
        const cellLength = cell ? cell.toString().length : 0;
        widths[i] = Math.max(widths[i] || 10, cellLength);
    });
    return widths;
}, []);

worksheet["!cols"] = autoWidth.map(width => ({
    wch: width + 3
}));

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "All Blocks Combined"
        );

        XLSX.writeFile(
            workbook,
            `Udhampur_Progress_Report_ALL_${selectedDate}.xlsx`
        );

        return;
    }

    // ==========================================
    // SINGLE BLOCK REPORT
    // ==========================================

    let dataRows = [[
        "Metric ID",
        "Parameter",
        "Domain",
        "Target",
        "Daily Value",
        "Cumulative Total"
    ]];

    metrics.forEach(metric => {

        if (!metric[0]) return;

        const metricDomain =
            (metric[2] || "GENERAL")
                .toString()
                .trim()
                .toUpperCase();

        if (
            selectedDomain !== "ALL" &&
            metricDomain !== selectedDomain
        ) {
            return;
        }

        const colIdx =
            blockHeaderMapping[selectedBlock];

        const targetValue =
            colIdx !== undefined
                ? (parseInt(metric[colIdx]) || 0)
                : 0;

        let dailyValue = 0;
        let totalValue = 0;

        achievements.forEach(a => {

            const achievementBlock =
                a[2]
                    ? a[2].toString().trim().toUpperCase()
                    : "";

            const achievementMetric =
                a[3]
                    ? a[3].toString().trim()
                    : "";

            if (
                achievementBlock === selectedBlock &&
                achievementMetric === metric[0]
            ) {
                const val = parseInt(a[4]) || 0;

                totalValue += val;

                const recordDate =
                    a[1]
                        ? a[1].toString().split("T")[0]
                        : "";

                if (recordDate === selectedDate) {
                    dailyValue += val;
                }
            }
        });

        dataRows.push([
            metric[0],
            metric[1],
            metricDomain,
            targetValue,
            dailyValue,
            totalValue
        ]);
    });

    let worksheet = XLSX.utils.aoa_to_sheet(dataRows);
	const autoWidth = dataRows.reduce((widths, row) => {
    row.forEach((cell, i) => {
        const cellLength = cell ? cell.toString().length : 0;
        widths[i] = Math.max(widths[i] || 10, cellLength);
    });
    return widths;
}, []);

worksheet["!cols"] = autoWidth.map(width => ({
    wch: width + 3
}));

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        selectedBlock
    );

    XLSX.writeFile(
        workbook,
        `${selectedBlock}_${selectedDomain}_${selectedDate}.xlsx`
    );
}
function renderRankingColumn() {
    const container = document.getElementById('admin-ranking-container');
    if (!container) return;

    const rankings = getDistrictWideRanking();

    if (rankings.length === 0) {
        container.innerHTML =
            '<p class="text-sm text-slate-400 p-4">No live data available.</p>';
        return;
    }

    container.innerHTML = `
        <div class="mt-6">
            <h3 class="font-bold text-slate-900 mb-3 uppercase text-xs tracking-widest">
                LIVE BLOCK RANKINGS
            </h3>
            <div class="flex flex-row gap-4 overflow-x-auto pb-4">
                ${rankings.map((block,index)=>`
                    <div class="flex items-center bg-white border border-slate-200 p-3 rounded-xl shadow-sm min-w-[180px]">
                        <div class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-xs font-black mr-3">
                            ${index + 1}
                        </div>
                        <div class="flex-1">
                            <p class="text-sm font-semibold">${block.name}</p>
                        </div>
                        <div>
                            <p class="font-black">${block.total}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function getDistrictWideRanking() {
    if (!globalCachedDashboardData) return [];

    let blockTotals = {};

    const achievements =
        globalCachedDashboardData.achievements.slice(1);

    achievements.forEach(row => {

        const block =
            row[2]
                ? row[2].toString().toUpperCase().trim()
                : "UNKNOWN";

        const value = parseInt(row[4]) || 0;

        blockTotals[block] =
            (blockTotals[block] || 0) + value;
    });

    return Object.entries(blockTotals)
        .map(([name,total]) => ({ name,total }))
        .sort((a,b) => b.total - a.total);
}
function logout() {
    sessionStorage.clear();
    location.reload();
}
function updateOnlineCount() {

    registerOnlineTab();
    cleanupOnlineTabs();

    const count = Object.keys(localStorage)
        .filter(key => key.startsWith("tab_"))
        .length;

    const el =
        document.getElementById("online-users-count");

    if (el) {
        el.innerText = count;
    }
}

setInterval(updateOnlineCount, 5000);

window.addEventListener("beforeunload", () => {
    localStorage.removeItem(ONLINE_TAB_ID);
});

updateOnlineCount();
