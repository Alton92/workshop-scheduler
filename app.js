document.addEventListener('DOMContentLoaded', () => {
    // --- DATA ---
    const workers = [ 
        { id: 1, name: "Expert Worker 1", color: "#a0c4ff" }, 
        { id: 2, name: "Expert Worker 2", color: "#a7d8de" }, 
        { id: 6, name: "Expert Worker 3", color: "#b3e5fc" }, 
        { id: 3, name: "General Worker 1", color: "#ffdcb3" }, 
        { id: 4, name: "General Worker 2", color: "#d8b2ff" }, 
        { id: 5, name: "General Worker 3", color: "#ffb3c8" }  
    ];
    const jobTypes = [ 
        { name: "AgroHS", outlineColor: "#008000", glowColor: "rgba(0, 128, 0, 0.7)" },
        { name: "ChassisPro", outlineColor: "#000000", glowColor: "rgba(50, 50, 50, 0.7)" },    
        { name: "Others", outlineColor: "#FF0000", glowColor: "rgba(255, 0, 0, 0.7)" }       
    ];

    // --- ROBUST DATA LOADING ---
    function parseTaskDates(task) {
        try {
            if (!task || typeof task.startDate === 'undefined' || typeof task.endDate === 'undefined') { return null; }
            const startDate = new Date(task.startDate);
            const endDate = new Date(task.endDate);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { return null; }
            const parsedTask = { 
                ...task, startDate, endDate,
                overtimeSundays: Array.isArray(task.overtimeSundays) ? task.overtimeSundays.map(d => formatDate(new Date(d + "T00:00:00"))) : [] 
            };
            if (parsedTask.overtimeSundays.length > 0) { parsedTask.overtimeSundays = [...new Set(parsedTask.overtimeSundays)];}
            if (typeof parsedTask.jobType === 'undefined') { parsedTask.jobType = ''; }
            return parsedTask;
        } catch (e) { console.error("Error parsing task dates:", task, e); return null; }
    }
    function parseLeaveDates(leave) {
        try {
            if (!leave || typeof leave.startDate === 'undefined' || typeof leave.endDate === 'undefined') { return null; }
            const startDate = new Date(leave.startDate);
            const endDate = new Date(leave.endDate);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { return null; }
            return { ...leave, startDate, endDate };
        } catch (e) { console.error("Error parsing leave dates:", leave, e); return null; }
    }

    let tasks = loadData('workshopTasks', parseTaskDates).filter(task => task !== null);
    let leaves = loadData('workshopLeaves', parseLeaveDates).filter(leave => leave !== null);
    let currentDisplayDate = new Date(); 
    currentDisplayDate.setHours(0,0,0,0); 
    const dayOfWeekInitial = currentDisplayDate.getDay();
    const diffToMondayInitial = dayOfWeekInitial === 0 ? -6 : 1 - dayOfWeekInitial;
    currentDisplayDate.setDate(currentDisplayDate.getDate() + diffToMondayInitial);

    // --- DOM ELEMENTS ---
    const ganttChartContainer = document.querySelector('.gantt-chart-container');
    const workerSelect = document.getElementById('workerSelect');
    const editWorkerSelect = document.getElementById('editWorkerSelect');
    const addJobForm = document.getElementById('addJobForm');
    const jobTypeSelect = document.getElementById('jobTypeSelect');
    const editJobTypeSelect = document.getElementById('editJobTypeSelect');
    const ganttChartDiv = document.getElementById('ganttChart');
    const ganttTimelineHeaderDiv = document.querySelector('.gantt-timeline-header');
    const ganttBodyDiv = document.querySelector('.gantt-body');
    const editTaskModal = document.getElementById('editTaskModal');
    const editJobForm = document.getElementById('editJobForm');
    const closeButton = document.querySelector('#editTaskModal .close-button');
    const editTaskIdInput = document.getElementById('editTaskId');
    const editJobNameInput = document.getElementById('editJobName');
    const editStartDateInput = document.getElementById('editStartDate');
    const editDurationInput = document.getElementById('editDuration');
    const deleteTaskButton = document.getElementById('deleteTaskButton');
    const prevPeriodBtn = document.getElementById('prevPeriodBtn'); 
    const nextPeriodBtn = document.getElementById('nextPeriodBtn'); 
    const currentPeriodSpan = document.getElementById('currentPeriodSpan'); 
    const chartFocusTitleSpan = document.getElementById('chartFocusTitle'); 
    const addLeaveForm = document.getElementById('addLeaveForm');
    const leaveWorkerSelect = document.getElementById('leaveWorkerSelect');
    const leaveStartDateInput = document.getElementById('leaveStartDate');
    const leaveEndDateInput = document.getElementById('leaveEndDate');
    const leaveReasonInput = document.getElementById('leaveReason');
    const editLeaveModal = document.getElementById('editLeaveModal');
    const editLeaveForm = document.getElementById('editLeaveForm');
    const closeLeaveButton = document.querySelector('#editLeaveModal .close-leave-button');
    const editLeaveIdInput = document.getElementById('editLeaveId');
    const editLeaveWorkerDisplay = document.getElementById('editLeaveWorkerDisplay');
    const editLeaveStartDateInput = document.getElementById('editLeaveStartDate');
    const editLeaveEndDateInput = document.getElementById('editLeaveEndDate');
    const editLeaveReasonInput = document.getElementById('editLeaveReason');
    const deleteLeaveButton = document.getElementById('deleteLeaveButton');

    // --- DRAG AND DROP STATE VARIABLES --- 
    let dragMode = null; 
    let draggedTaskElement = null;
    let draggedTaskId = null;
    let dragStartX = 0; 
    let dragStartY = 0; 
    let originalTaskLeft = 0; 
    let originalTaskWidth = 0; 
    let originalTaskStartDate = null;
    let originalTaskDuration = 0;
    let originalWorkerId = null; 
    let isActualDrag = false; 
    const resizeHandleActiveZone = 10; 
    let currentCellWidth = 50; 
    let workerRowElements = []; 
    let currentHoverWorkerId = null;

    // --- DATE HELPER FUNCTIONS ---
    function formatDate(dateObj, includeYear = true) { 
        const d = new Date(dateObj);
        let monthVal = '' + (d.getMonth() + 1);
        let dayVal = '' + d.getDate();
        const yearVal = d.getFullYear();
        if (monthVal.length < 2) monthVal = '0' + monthVal;
        if (dayVal.length < 2) dayVal = '0' + dayVal;
        if (includeYear) { return [yearVal, monthVal, dayVal].join('-'); } 
        else { return [dayVal, monthVal].join('/'); }
    }
    function addDays(dateObj, days) {
        const result = new Date(dateObj);
        result.setHours(0, 0, 0, 0); 
        result.setDate(result.getDate() + days);
        return result;
    }
    function getSundaysInRange(startDate, endDate) {
        const sundays = [];
        let currentDateIter = new Date(startDate); currentDateIter.setHours(0,0,0,0);
        const finalEndDate = new Date(endDate); finalEndDate.setHours(0,0,0,0);
        while (currentDateIter.getTime() <= finalEndDate.getTime()) {
            if (currentDateIter.getDay() === 0) { sundays.push(formatDate(currentDateIter)); }
            currentDateIter.setDate(currentDateIter.getDate() + 1);
        }
        return sundays;
    }
    async function confirmOvertimeForSundays(taskName, newSundaysList) {
        if (!newSundaysList || newSundaysList.length === 0) return [];
        const sundayDatesString = newSundaysList.map(sDateStr => {
            const dateObj = new Date(sDateStr + "T00:00:00"); 
            return dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        }).join(', ');
        if (window.confirm(`Task "${taskName}" now covers Sunday(s): ${sundayDatesString}.\nDo you want to mark these as overtime working days?`)) {
            return newSundaysList; 
        }
        return []; 
    }

    // --- GENERIC LOCAL STORAGE FUNCTIONS ---
    function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data));}
    function loadData(key, dateParserFn) {
        const storedData = localStorage.getItem(key);
        if (storedData) { 
            try {
                const parsedItems = JSON.parse(storedData);
                if (Array.isArray(parsedItems)) { return parsedItems.map(item => dateParserFn(item)); } 
                else { console.warn("Stored data is not an array for key:", key); return []; }
            } catch (e) { console.error("Error parsing JSON from localStorage for key:", key, e); return []; }
        }
        return [];
    }
    
    // --- MODAL CONTROL FUNCTIONS ---
    function closeModal() { editTaskModal.style.display = 'none'; }
    function openEditModal(taskId) {
        if (isActualDrag || dragMode) { isActualDrag = false; return; }
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        editTaskIdInput.value = task.id; editJobNameInput.value = task.name; editWorkerSelect.value = task.workerId;
        editJobTypeSelect.value = task.jobType || (jobTypes.length > 0 ? jobTypes[0].name : ''); 
        editStartDateInput.value = formatDate(task.startDate); editDurationInput.value = task.duration;
        editTaskModal.style.display = 'block';
    }
    function closeLeaveModal() { editLeaveModal.style.display = 'none'; }
    function openEditLeaveModal(leaveId) {
        const leave = leaves.find(l => l.id === leaveId);
        if (!leave) return;
        const worker = workers.find(w => w.id === leave.workerId);
        editLeaveIdInput.value = leave.id; editLeaveWorkerDisplay.value = worker ? worker.name : 'Unknown Worker'; 
        editLeaveStartDateInput.value = formatDate(leave.startDate); editLeaveEndDateInput.value = formatDate(leave.endDate);   
        editLeaveReasonInput.value = leave.reason || '';
        editLeaveModal.style.display = 'block';
    }

    // --- POPULATION FUNCTIONS ---
    function populateWorkerSelects() {
        workerSelect.innerHTML = ''; editWorkerSelect.innerHTML = ''; leaveWorkerSelect.innerHTML = ''; 
        workers.forEach(worker => {
            const option = document.createElement('option');
            option.value = worker.id; option.textContent = worker.name;
            workerSelect.appendChild(option.cloneNode(true));
            editWorkerSelect.appendChild(option.cloneNode(true));
            leaveWorkerSelect.appendChild(option.cloneNode(true)); 
        });
    }
    function populateJobTypeSelects() {
        jobTypeSelect.innerHTML = ''; editJobTypeSelect.innerHTML = ''; 
        jobTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.name; option.textContent = type.name;
            jobTypeSelect.appendChild(option.cloneNode(true));
            editJobTypeSelect.appendChild(option.cloneNode(true));
        });
    }

    // --- Pointer Coordinate Helper ---
    function getPointerCoordinates(event) {
        if (event.type.startsWith('touch')) {
            // For touchend, use changedTouches
            if (event.changedTouches && event.changedTouches.length > 0) {
                return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
            }
            return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        } else {
            return { x: event.clientX, y: event.clientY };
        }
    }

    // --- RENDERING FUNCTIONS ---
    function renderBarOnChart(item, cellsDiv, periodStartDate, daysInPeriod, cellWidthForCalc, type) {
        const itemStartDateOriginal = new Date(item.startDate); 
        const itemEndDateOriginal = new Date(item.endDate);   
        const itemStartDay = new Date(itemStartDateOriginal); itemStartDay.setHours(0,0,0,0); 
        const itemEndDay = new Date(itemEndDateOriginal); itemEndDay.setHours(0,0,0,0); 
        const periodStartDay = new Date(periodStartDate); 
        const periodEndViewDay = addDays(new Date(periodStartDay), daysInPeriod - 1); 

        if (itemEndDay < periodStartDay || itemStartDay > periodEndViewDay) { return; }

        let renderStartIndexInPeriod = 0;
        if (itemStartDay > periodStartDay) {
            const diffTime = itemStartDay.getTime() - periodStartDay.getTime();
            renderStartIndexInPeriod = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }
        let renderEndIndexInPeriod = daysInPeriod - 1;
        if (itemEndDay < periodEndViewDay) {
            const diffTime = itemEndDay.getTime() - periodStartDay.getTime();
            renderEndIndexInPeriod = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }
        renderStartIndexInPeriod = Math.max(0, renderStartIndexInPeriod);
        renderEndIndexInPeriod = Math.min(daysInPeriod - 1, renderEndIndexInPeriod);
        renderEndIndexInPeriod = Math.max(renderStartIndexInPeriod, renderEndIndexInPeriod); 
            
        const offsetDays = renderStartIndexInPeriod;
        const durationInView = renderEndIndexInPeriod - renderStartIndexInPeriod + 1;

        if (durationInView <= 0) return;
        
        const barElement = document.createElement('div');
        barElement.dataset.id = String(item.id);

        if (type === 'task') {
            barElement.classList.add('task-bar');
            barElement.addEventListener('mousedown', (e) => handleDragStart(e, item, barElement)); 
            barElement.addEventListener('touchstart', (e) => handleDragStart(e, item, barElement), { passive: false }); 
            barElement.addEventListener('mousemove', (e) => { 
                 if (!dragMode) { 
                    const rect = barElement.getBoundingClientRect();
                    const mouseXInElement = e.clientX - rect.left;
                    if (mouseXInElement < resizeHandleActiveZone || mouseXInElement > barElement.offsetWidth - resizeHandleActiveZone) {
                        barElement.style.cursor = 'ew-resize';
                    } else {
                        barElement.style.cursor = 'grab';
                    }
                }
            });
            barElement.addEventListener('mouseleave', (e) => { if (!dragMode) barElement.style.cursor = 'grab'; });
            barElement.addEventListener('click', (e) => { openEditModal(item.id); });
            
            barElement.textContent = `${item.name} (${item.duration}d)`;
            
            const assignedWorker = workers.find(w => w.id === item.workerId);
            if (assignedWorker) { barElement.style.backgroundColor = assignedWorker.color; }
            else { barElement.style.backgroundColor = "#cccccc"; }
            
            const jobTypeData = jobTypes.find(jt => jt.name === item.jobType);
            if (jobTypeData) {
                barElement.style.outlineColor = jobTypeData.outlineColor;
                barElement.style.setProperty('--hover-glow-color', jobTypeData.glowColor); 
            } else { barElement.style.outlineColor = '#888'; }
            
            barElement.title = `Job: ${item.name}${item.overtimeSundays && item.overtimeSundays.length > 0 ? ' (Includes Overtime)' : ''}\nType: ${item.jobType || 'N/A'}\nWorker: ${assignedWorker ? assignedWorker.name : 'Unknown'}\nStart: ${formatDate(itemStartDateOriginal)}\nEnd: ${formatDate(itemEndDateOriginal)}\nDuration: ${item.duration} days`;

            if (item.overtimeSundays && item.overtimeSundays.length > 0) {
                for (let i = 0; i < durationInView; i++) {
                    const dayIndexInTaskView = renderStartIndexInPeriod + i; 
                    const currentDateInLoop = addDays(new Date(periodStartDay), dayIndexInTaskView);
                    if (currentDateInLoop.getDay() === 0) { 
                        const currentDateStr = formatDate(currentDateInLoop); 
                        if (item.overtimeSundays.includes(currentDateStr)) {
                            const otIndicatorDiv = document.createElement('div');
                            otIndicatorDiv.classList.add('task-bar-ot-indicator');
                            otIndicatorDiv.textContent = "+1D"; 
                            otIndicatorDiv.style.width = `${cellWidthForCalc}px`;
                            otIndicatorDiv.style.left = `${i * cellWidthForCalc}px`; 
                            barElement.appendChild(otIndicatorDiv);
                        }
                    }
                }
            }
        } else if (type === 'leave') {
            barElement.classList.add('leave-bar');
            barElement.textContent = item.reason ? item.reason : "On Leave"; 
            const workerOnLeave = workers.find(w => w.id === item.workerId);
            barElement.title = `On Leave: ${workerOnLeave ? workerOnLeave.name : 'Unknown'}\nStart: ${formatDate(itemStartDateOriginal)}\nEnd: ${formatDate(itemEndDateOriginal)}\nReason: ${item.reason || 'N/A'}`;
            barElement.addEventListener('click', () => openEditLeaveModal(item.id));
        }
        
        barElement.style.left = `${offsetDays * cellWidthForCalc}px`;
        barElement.style.width = `${durationInView * cellWidthForCalc - 2}px`; 
        cellsDiv.appendChild(barElement);
    }

    function renderGanttChart() {
        if (!ganttTimelineHeaderDiv || !ganttBodyDiv || !currentPeriodSpan || !chartFocusTitleSpan || !ganttChartContainer || !ganttChartDiv ) {
            console.error("Critical DOM elements for Gantt chart not found! Cannot render.");
            return;
        }
        ganttTimelineHeaderDiv.innerHTML = '';
        ganttBodyDiv.innerHTML = '';
        workerRowElements = []; // Clear before populating

        const daysInView = 14;
        const firstDayOfView = new Date(currentDisplayDate); 
        firstDayOfView.setHours(0,0,0,0); 
        const lastDayOfView = addDays(new Date(firstDayOfView), daysInView - 1);
        const rangeOptions = { month: 'short', day: 'numeric' };
        let periodText = `${firstDayOfView.toLocaleDateString(undefined, rangeOptions)} - ${lastDayOfView.toLocaleDateString(undefined, rangeOptions)}, ${firstDayOfView.getFullYear()}`;
        if (firstDayOfView.getFullYear() !== lastDayOfView.getFullYear()) {
             periodText = `${firstDayOfView.toLocaleDateString(undefined, {...rangeOptions, year: 'numeric'})} - ${lastDayOfView.toLocaleDateString(undefined, {...rangeOptions, year: 'numeric'})}`;
        }
        currentPeriodSpan.textContent = periodText;
        chartFocusTitleSpan.textContent = `${firstDayOfView.toLocaleString('default', { month: 'long' })} ${firstDayOfView.getFullYear()}`;

        const workerNameHeaderPlaceholder = document.querySelector('.gantt-row-header'); 
        const workerNameColumnWidth = workerNameHeaderPlaceholder ? workerNameHeaderPlaceholder.offsetWidth : 130; 
        const availableFullWidth = ganttChartContainer.clientWidth;
        const availableTimelineWidth = availableFullWidth - workerNameColumnWidth - 2; 
        currentCellWidth = Math.max(40, Math.floor(availableTimelineWidth / daysInView)); 

        for (let i = 0; i < daysInView; i++) {
            const dayDate = addDays(new Date(firstDayOfView), i);
            const dayCell = document.createElement('div');
            dayCell.classList.add('gantt-day-header');
            dayCell.textContent = formatDate(dayDate, false); 
            dayCell.style.width = `${currentCellWidth}px`; 
            dayCell.style.minWidth = `${currentCellWidth}px`; 
            dayCell.style.flex = `0 0 ${currentCellWidth}px`; 
            dayCell.title = dayDate.toLocaleDateString(); 
            if (dayDate.getDay() === 0) dayCell.classList.add('gantt-day-sunday'); 
            ganttTimelineHeaderDiv.appendChild(dayCell);
        }

        if (!workers || workers.length === 0) return;

        workers.forEach((worker, index) => {
            try {
                const workerNameCell = document.createElement('div'); 
                workerNameCell.classList.add('gantt-worker-name'); 
                const cellsDiv = document.createElement('div'); 
                cellsDiv.classList.add('gantt-cells'); 
                const rowClass = (index % 2 === 0) ? 'gantt-row-even' : 'gantt-row-odd';
                workerNameCell.classList.add(rowClass); 
                cellsDiv.classList.add(rowClass);      
                workerNameCell.textContent = worker.name; 
                
                // Create a wrapper for the row to help with getBoundingClientRect later if needed for precision
                // For now, we use cellsDiv which should be part of the grid flow
                const logicalRowWrapper = document.createElement('div');
                logicalRowWrapper.style.display = 'contents'; // Keep it from affecting layout
                logicalRowWrapper.appendChild(workerNameCell);
                logicalRowWrapper.appendChild(cellsDiv);
                ganttBodyDiv.appendChild(logicalRowWrapper); 
                
                workerRowElements.push({ workerId: worker.id, nameCell: workerNameCell, cellsElement: cellsDiv });

                for (let i = 0; i < daysInView; i++) { 
                    const cellDate = addDays(new Date(firstDayOfView), i);
                    const cell = document.createElement('div'); 
                    cell.classList.add('gantt-cell');
                    cell.style.width = `${currentCellWidth}px`; 
                    cell.style.minWidth = `${currentCellWidth}px`;
                    cell.style.flex = `0 0 ${currentCellWidth}px`;
                    if (cellDate.getDay() === 0) cell.classList.add('gantt-cell-sunday');
                    cellsDiv.appendChild(cell);
                }
                
                const workerTasks = tasks.filter(task => task && task.workerId === worker.id);
                workerTasks.forEach(task => { 
                    renderBarOnChart(task, cellsDiv, firstDayOfView, daysInView, currentCellWidth, 'task'); 
                });
                const workerLeaves = leaves.filter(leave => leave && leave.workerId === worker.id);
                workerLeaves.forEach(leave => { 
                    renderBarOnChart(leave, cellsDiv, firstDayOfView, daysInView, currentCellWidth, 'leave'); 
                });
            } catch (e) {
                console.error(`Error processing worker ${worker.name}:`, e);
            }
        });
    }

    // --- DRAG AND DROP HANDLER FUNCTIONS ---
    function handleDragStart(event, taskItem, element) { 
        const taskId = taskItem.id;
        if (event.type === 'mousedown' && event.button !== 0) return;
        if (editTaskModal.style.display === 'block' || editLeaveModal.style.display === 'block') return;
        if (!taskItem) return; // TaskItem is already the task object
        if (event.type === 'touchstart') event.preventDefault(); 
        isActualDrag = false; 
        const coords = getPointerCoordinates(event);
        const rect = element.getBoundingClientRect();
        const pointerXInElement = coords.x - rect.left;
        if (pointerXInElement < resizeHandleActiveZone) {
            dragMode = 'resize-left'; document.body.style.cursor = 'ew-resize';
        } else if (pointerXInElement > element.offsetWidth - resizeHandleActiveZone) {
            dragMode = 'resize-right'; document.body.style.cursor = 'ew-resize';
        } else {
            dragMode = 'move'; document.body.style.cursor = 'grabbing';
        }
        draggedTaskElement = element;
        draggedTaskId = taskId;
        dragStartX = coords.x; 
        dragStartY = coords.y;
        originalTaskLeft = element.offsetLeft; 
        originalTaskWidth = element.offsetWidth;
        originalTaskStartDate = new Date(taskItem.startDate); 
        originalTaskDuration = taskItem.duration;
        originalWorkerId = taskItem.workerId; 
        element.classList.add('dragging'); 
        document.addEventListener('mousemove', handleDragging);
        document.addEventListener('touchmove', handleDragging, { passive: false });
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('touchend', handleDragEnd);
    }

    function handleDragging(event) { 
        if (!dragMode || !draggedTaskElement) return;
        if (event.type === 'touchmove') event.preventDefault(); 
        const coords = getPointerCoordinates(event);
        const dx = coords.x - dragStartX;
        const dy = coords.y - dragStartY; 
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isActualDrag = true;

        if (dragMode === 'move') {
            let newLeft = originalTaskLeft + dx; 
            const dayIndex = Math.round(newLeft / currentCellWidth); 
            newLeft = dayIndex * currentCellWidth;
            const maxLeft = (14 * currentCellWidth) - draggedTaskElement.offsetWidth;
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            draggedTaskElement.style.left = `${newLeft}px`;
            // Highlight target worker row
            let targetWorkerRowFound = null;
            workerRowElements.forEach(rowInfo => {
                const rowRect = rowInfo.cellsElement.getBoundingClientRect();
                if (coords.y >= rowRect.top && coords.y <= rowRect.bottom) {
                    targetWorkerRowFound = rowInfo;
                }
                if (rowInfo.workerId !== (targetWorkerRowFound ? targetWorkerRowFound.workerId : null)) {
                    rowInfo.nameCell.classList.remove('worker-row-drop-target');
                    rowInfo.cellsElement.classList.remove('worker-row-drop-target');
                }
            });
            if (targetWorkerRowFound) {
                if (currentHoverWorkerId !== targetWorkerRowFound.workerId) {
                    const oldHovered = workerRowElements.find(w => w.workerId === currentHoverWorkerId);
                    if(oldHovered) {
                        oldHovered.nameCell.classList.remove('worker-row-drop-target');
                        oldHovered.cellsElement.classList.remove('worker-row-drop-target');
                    }
                    targetWorkerRowFound.nameCell.classList.add('worker-row-drop-target');
                    targetWorkerRowFound.cellsElement.classList.add('worker-row-drop-target');
                    currentHoverWorkerId = targetWorkerRowFound.workerId;
                }
            } else { 
                const oldHovered = workerRowElements.find(w => w.workerId === currentHoverWorkerId);
                if(oldHovered) {
                    oldHovered.nameCell.classList.remove('worker-row-drop-target');
                    oldHovered.cellsElement.classList.remove('worker-row-drop-target');
                }
                currentHoverWorkerId = null;
            }
        } else if (dragMode === 'resize-left') {
            let newLeft = originalTaskLeft + dx; let newWidth = originalTaskWidth - dx; 
            const dayIndex = Math.round(newLeft / currentCellWidth); const snappedNewLeft = dayIndex * currentCellWidth;
            newWidth += (originalTaskLeft - snappedNewLeft); newLeft = snappedNewLeft;
            const minPixelWidth = currentCellWidth; 
            if (newWidth < minPixelWidth) { newWidth = minPixelWidth; newLeft = (originalTaskLeft + originalTaskWidth) - minPixelWidth; }
            newLeft = Math.max(0, newLeft);
            if (newLeft + newWidth > 14 * currentCellWidth) { newWidth = (14 * currentCellWidth) - newLeft; }
            draggedTaskElement.style.left = `${newLeft}px`; draggedTaskElement.style.width = `${newWidth}px`;
        } else if (dragMode === 'resize-right') {
            let newWidth = originalTaskWidth + dx; 
            const numDays = Math.round(newWidth / currentCellWidth); newWidth = numDays * currentCellWidth;
            const minPixelWidth = currentCellWidth; newWidth = Math.max(minPixelWidth, newWidth);
            const maxPossibleWidth = (14 * currentCellWidth) - originalTaskLeft; newWidth = Math.min(newWidth, maxPossibleWidth);
            draggedTaskElement.style.width = `${newWidth}px`;
        }
    }

    async function handleDragEnd(event) { 
        const currentDragMode = dragMode; 
        const wasAnActualDrag = isActualDrag; 
        workerRowElements.forEach(rowInfo => {
            rowInfo.nameCell.classList.remove('worker-row-drop-target');
            rowInfo.cellsElement.classList.remove('worker-row-drop-target');
        });
        currentHoverWorkerId = null;
        if (draggedTaskElement) {
            draggedTaskElement.classList.remove('dragging');
            draggedTaskElement.style.cursor = 'grab'; 
        }
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', handleDragging);
        document.removeEventListener('touchmove', handleDragging);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchend', handleDragEnd);

        if (!currentDragMode || !draggedTaskElement || draggedTaskId === null) {
            dragMode = null; draggedTaskElement = null; isActualDrag = false; return;
        }
        
        let dataChanged = false;
        const taskIndex = tasks.findIndex(t => t.id === draggedTaskId);

        if (taskIndex !== -1 && (wasAnActualDrag || currentDragMode.startsWith('resize-'))) {
            const task = tasks[taskIndex];
            const originalOvertimeSundaysForConfirmation = [...task.overtimeSundays]; 
            let newStartDate = new Date(originalTaskStartDate); 
            let newDuration = originalTaskDuration;       
            let newWorkerId = originalWorkerId; 
            const finalLeftPixels = parseFloat(draggedTaskElement.style.left);
            const finalWidthPixels = parseFloat(draggedTaskElement.style.width);
            const pointerCoords = getPointerCoordinates(event.type.startsWith('touch') && event.changedTouches && event.changedTouches.length > 0 ? event.changedTouches[0] : event);

            if (currentDragMode === 'move') {
                for (const rowInfo of workerRowElements) {
                    const rowRect = rowInfo.cellsElement.getBoundingClientRect();
                    if (pointerCoords.y >= rowRect.top && pointerCoords.y <= rowRect.bottom) {
                        newWorkerId = rowInfo.workerId; break;
                    }
                }
                const daysOffset = Math.round(finalLeftPixels / currentCellWidth);
                const firstDayOfCurrentView = new Date(currentDisplayDate); firstDayOfCurrentView.setHours(0,0,0,0);
                newStartDate = addDays(firstDayOfCurrentView, daysOffset);
                if (task.startDate.getTime() !== newStartDate.getTime() || task.workerId !== newWorkerId) dataChanged = true;
            } else if (currentDragMode === 'resize-left') {
                const daysShiftedForStart = Math.round((finalLeftPixels - originalTaskLeft) / currentCellWidth); 
                newStartDate = addDays(new Date(originalTaskStartDate), daysShiftedForStart);
                const originalEndDateForCalc = addDays(new Date(originalTaskStartDate), originalTaskDuration -1);
                let calculatedNewDuration = Math.round((originalEndDateForCalc.getTime() - newStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                newDuration = Math.max(1, calculatedNewDuration); 
                if (task.startDate.getTime() !== newStartDate.getTime() || task.duration !== newDuration) dataChanged = true;
            } else if (currentDragMode === 'resize-right') {
                newDuration = Math.round(finalWidthPixels / currentCellWidth); 
                newDuration = Math.max(1, newDuration); 
                if (task.duration !== newDuration) dataChanged = true;
            }

            if (dataChanged) {
                const finalProposedEndDate = addDays(new Date(newStartDate), newDuration - 1);
                const allSundaysInNewRange = getSundaysInRange(newStartDate, finalProposedEndDate);
                let confirmedSundaysForNewRange = originalOvertimeSundaysForConfirmation.filter(sunDateStr => {
                    const sunDate = new Date(sunDateStr + "T00:00:00");
                    return sunDate >= newStartDate && sunDate <= finalProposedEndDate;
                });
                const sundaysNeedingFreshConfirmation = allSundaysInNewRange.filter(
                    sunDateStr => !confirmedSundaysForNewRange.includes(sunDateStr)
                );
                if (sundaysNeedingFreshConfirmation.length > 0) {
                    const newlyConfirmedOT = await confirmOvertimeForSundays(task.name, sundaysNeedingFreshConfirmation);
                    newlyConfirmedOT.forEach(confirmedSun => {
                        if (!confirmedSundaysForNewRange.includes(confirmedSun)) { confirmedSundaysForNewRange.push(confirmedSun); }
                    });
                }
                task.workerId = newWorkerId; 
                task.startDate = newStartDate;
                task.duration = newDuration; 
                task.endDate = finalProposedEndDate;
                task.overtimeSundays = [...new Set(confirmedSundaysForNewRange)]; 
                saveData('workshopTasks', tasks);
            }
        }
        
        dragMode = null; draggedTaskElement = null; draggedTaskId = null;
        isActualDrag = false; 
        if (dataChanged) renderGanttChart(); 
    }

    // --- EVENT HANDLER FUNCTIONS (TASK & LEAVE MANAGEMENT, TIMELINE) ---
    async function handleAddTask(event) { /* ... */ }
    async function handleEditTask(event) { /* ... */ }
    function handleDeleteTask() { /* ... */ }
    function handleAddLeave(event) { /* ... */ }
    function handleEditLeave(event) { /* ... */ }
    function handleDeleteLeave() { /* ... */ }
    function showPreviousPeriod() { /* ... */ }
    function showNextPeriod() { /* ... */ }
    // Actual implementations (copied from V1.3)
    async function handleAddTask(event) {
        event.preventDefault();
        const jobName = document.getElementById('jobName').value;
        const workerId = parseInt(workerSelect.value);
        const jobType = jobTypeSelect.value; 
        const startDateStr = document.getElementById('startDate').value;
        const startDate = new Date(startDateStr + "T00:00:00");
        const duration = parseInt(document.getElementById('duration').value);
        if (!jobName || !workerId || !jobType || !startDateStr || isNaN(startDate.getTime()) || duration < 1) { alert("Please fill in all fields correctly, including Job Type. Ensure start date is valid."); return; }
        const endDate = addDays(new Date(startDate), duration - 1);
        const newPotentialSundays = getSundaysInRange(startDate, endDate);
        let confirmedOvertime = [];
        if (newPotentialSundays.length > 0) {
            confirmedOvertime = await confirmOvertimeForSundays(jobName, newPotentialSundays);
        }
        const newTask = { id: Date.now(), name: jobName, workerId: workerId, jobType: jobType, startDate: startDate, duration: duration, endDate: endDate, overtimeSundays: confirmedOvertime };
        tasks.push(newTask);
        saveData('workshopTasks', tasks);
        renderGanttChart();
        addJobForm.reset(); 
        document.getElementById('startDate').value = formatDate(new Date());
    }
    async function handleEditTask(event) { 
        event.preventDefault();
        const taskId = parseInt(editTaskIdInput.value);
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;
        const task = tasks[taskIndex];
        const originalOvertimeSundays = [...task.overtimeSundays]; 
        const newJobName = editJobNameInput.value;
        const newWorkerId = parseInt(editWorkerSelect.value);
        const newJobType = editJobTypeSelect.value; 
        const newStartDateStr = editStartDateInput.value;
        const newStartDate = new Date(newStartDateStr + "T00:00:00");
        const newDuration = parseInt(editDurationInput.value);
        if (!newJobName || isNaN(newWorkerId) || !newJobType || !newStartDateStr || isNaN(newStartDate.getTime()) || newDuration < 1) { alert("Please fill in all fields correctly in the edit form, including Job Type. Ensure start date is valid."); return; }
        const newEndDate = addDays(new Date(newStartDate), newDuration - 1);
        const allSundaysInNewRange = getSundaysInRange(newStartDate, newEndDate);
        let finalOvertimeSundays = originalOvertimeSundays.filter(sunDateStr => {
            const sunDate = new Date(sunDateStr + "T00:00:00");
            return sunDate >= newStartDate && sunDate <= newEndDate;
        });
        const sundaysNeedingFreshConfirmation = allSundaysInNewRange.filter(
            sunDateStr => !finalOvertimeSundays.includes(sunDateStr)
        );
        if (sundaysNeedingFreshConfirmation.length > 0) {
            const newlyConfirmedOT = await confirmOvertimeForSundays(newJobName, sundaysNeedingFreshConfirmation);
            newlyConfirmedOT.forEach(confirmedSun => {
                if (!finalOvertimeSundays.includes(confirmedSun)) { finalOvertimeSundays.push(confirmedSun); }
            });
        }
        task.name = newJobName; task.workerId = newWorkerId; task.jobType = newJobType; 
        task.startDate = newStartDate; task.duration = newDuration; task.endDate = newEndDate;
        task.overtimeSundays = [...new Set(finalOvertimeSundays)];
        saveData('workshopTasks', tasks);
        renderGanttChart();
        closeModal(); 
    }
    function handleDeleteTask() {
        const taskId = parseInt(editTaskIdInput.value);
        tasks = tasks.filter(t => t.id !== taskId);
        saveData('workshopTasks', tasks);
        renderGanttChart();
        closeModal(); 
    }
    function handleAddLeave(event) {
        event.preventDefault();
        const workerId = parseInt(leaveWorkerSelect.value);
        const startDateStr = leaveStartDateInput.value;
        const endDateStr = leaveEndDateInput.value;
        const reason = leaveReasonInput.value.trim();
        if (!workerId || !startDateStr || !endDateStr) { alert("Please select a worker and specify leave start and end dates."); return; }
        const startDate = new Date(startDateStr + "T00:00:00");
        const endDate = new Date(endDateStr + "T23:59:59"); 
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { alert("Invalid date format for leave."); return; }
        if (endDate < startDate) { alert("Leave end date cannot be before start date."); return; }
        const newLeave = { id: Date.now(), workerId: workerId, startDate: startDate, endDate: endDate, reason: reason };
        leaves.push(newLeave);
        saveData('workshopLeaves', leaves);
        renderGanttChart();
        addLeaveForm.reset();
        leaveStartDateInput.value = formatDate(new Date()); 
        leaveEndDateInput.value = formatDate(new Date());
    }
    function handleEditLeave(event) {
        event.preventDefault();
        const leaveId = parseInt(editLeaveIdInput.value);
        const leaveIndex = leaves.findIndex(l => l.id === leaveId);
        if (leaveIndex === -1) return;
        const startDateStr = editLeaveStartDateInput.value;
        const endDateStr = editLeaveEndDateInput.value;
        if (!startDateStr || !endDateStr) { alert("Leave start and end dates are required."); return; }
        const newStartDate = new Date(startDateStr + "T00:00:00");
        const newEndDate = new Date(endDateStr + "T23:59:59");
        if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) { alert("Invalid date format for leave update."); return; }
        if (newEndDate < newStartDate) { alert("Leave end date cannot be before start date for update."); return; }
        leaves[leaveIndex].startDate = newStartDate;
        leaves[leaveIndex].endDate = newEndDate;
        leaves[leaveIndex].reason = editLeaveReasonInput.value.trim();
        saveData('workshopLeaves', leaves);
        renderGanttChart();
        closeLeaveModal(); 
    }
    function handleDeleteLeave() {
        const leaveId = parseInt(editLeaveIdInput.value);
        leaves = leaves.filter(l => l.id !== leaveId);
        saveData('workshopLeaves', leaves);
        renderGanttChart();
        closeLeaveModal(); 
    }
    function showPreviousPeriod() { 
        currentDisplayDate = addDays(currentDisplayDate, -14); 
        const dayOfWeek = currentDisplayDate.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        currentDisplayDate.setDate(currentDisplayDate.getDate() + diffToMonday);
        renderGanttChart(); 
    }
    function showNextPeriod() { 
        currentDisplayDate = addDays(currentDisplayDate, 14); 
        const dayOfWeek = currentDisplayDate.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        currentDisplayDate.setDate(currentDisplayDate.getDate() + diffToMonday);
        renderGanttChart(); 
    }

    // --- INITIALIZATION FUNCTION DEFINITION ---
    function init() {
        populateWorkerSelects();
        populateJobTypeSelects();
        addJobForm.addEventListener('submit', handleAddTask); 
        editJobForm.addEventListener('submit', handleEditTask); 
        deleteTaskButton.addEventListener('click', handleDeleteTask);
        if(closeButton) closeButton.addEventListener('click', closeModal); 
        addLeaveForm.addEventListener('submit', handleAddLeave);
        editLeaveForm.addEventListener('submit', handleEditLeave);
        deleteLeaveButton.addEventListener('click', handleDeleteLeave);
        if(closeLeaveButton) closeLeaveButton.addEventListener('click', closeLeaveModal); 
        window.addEventListener('click', (event) => {
            if (event.target === editTaskModal) closeModal();
            if (event.target === editLeaveModal) closeLeaveModal(); 
        });
        if(prevPeriodBtn) prevPeriodBtn.addEventListener('click', showPreviousPeriod);
        if(nextPeriodBtn) nextPeriodBtn.addEventListener('click', showNextPeriod);
        if(document.getElementById('startDate')) document.getElementById('startDate').value = formatDate(new Date()); 
        if(leaveStartDateInput) leaveStartDateInput.value = formatDate(new Date()); 
        if(leaveEndDateInput) leaveEndDateInput.value = formatDate(new Date()); 
        renderGanttChart(); 
    }

    // --- START THE APP ---
    init();
});
