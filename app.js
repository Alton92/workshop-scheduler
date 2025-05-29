document.addEventListener('DOMContentLoaded', () => {
    // --- DATA --- (Same)
    const workers = [ 
        { id: 1, name: "Expert Worker 1", color: "#a9d0f5" }, 
        { id: 2, name: "Expert Worker 2", color: "#7fcdbb" }, 
        { id: 6, name: "Expert Worker 3", color: "#b3e5fc" }, 
        { id: 3, name: "General Worker 1", color: "#f7dc6f" }, 
        { id: 4, name: "General Worker 2", color: "#f1948a" }, 
        { id: 5, name: "General Worker 3", color: "#c39bd3" }  
    ];
    const jobTypes = [ 
        { name: "AgroHS", outlineColor: "#008000", glowColor: "rgba(0, 128, 0, 0.7)" },
        { name: "ChassisPro", outlineColor: "#000000", glowColor: "rgba(50, 50, 50, 0.7)" },    
        { name: "Others", outlineColor: "#FF0000", glowColor: "rgba(255, 0, 0, 0.7)" }       
    ];

    // --- ROBUST DATA LOADING --- (Same)
    function parseTaskDates(task) { /* ... */ }
    function parseLeaveDates(leave) { /* ... */ }
    // Actual implementations
    function parseTaskDates(task) {
        try {
            if (!task || typeof task.startDate === 'undefined' || typeof task.endDate === 'undefined') { return null; }
            const startDate = new Date(task.startDate);
            const endDate = new Date(task.endDate);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { return null; }
            const parsedTask = { ...task, startDate, endDate };
            if (typeof parsedTask.jobType === 'undefined') { parsedTask.jobType = ''; }
            return parsedTask;
        } catch (e) { return null; }
    }
    function parseLeaveDates(leave) {
        try {
            if (!leave || typeof leave.startDate === 'undefined' || typeof leave.endDate === 'undefined') { return null; }
            const startDate = new Date(leave.startDate);
            const endDate = new Date(leave.endDate);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { return null; }
            return { ...leave, startDate, endDate };
        } catch (e) { return null; }
    }

    let tasks = loadData('workshopTasks', parseTaskDates).filter(task => task !== null);
    let leaves = loadData('workshopLeaves', parseLeaveDates).filter(leave => leave !== null);
    let currentDisplayDate = new Date(); 
    currentDisplayDate.setHours(0,0,0,0); 
    const dayOfWeekInitial = currentDisplayDate.getDay();
    const diffToMondayInitial = dayOfWeekInitial === 0 ? -6 : 1 - dayOfWeekInitial;
    currentDisplayDate.setDate(currentDisplayDate.getDate() + diffToMondayInitial);

    // --- DOM ELEMENTS --- (Same)
    // ... (all DOM elements as before) ...
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

    // --- DRAG AND DROP STATE VARIABLES --- MODIFIED
    let dragMode = null; 
    let draggedTaskElement = null;
    let draggedTaskId = null;
    let dragStartX = 0; 
    let originalTaskLeft = 0; 
    let originalTaskWidth = 0; 
    let originalTaskStartDate = null;
    let originalTaskDuration = 0;
    let isActualDrag = false; // NEW: Flag to distinguish click from drag
    const cellWidth = 50; 
    const resizeHandleActiveZone = 10; 

    // --- DATE HELPER FUNCTIONS --- (Same)
    function getDaysInMonth(year, month) { /* ... */ }
    function formatDate(dateObj, includeYear = true) { /* ... */ }
    function addDays(dateObj, days) { /* ... */ }
    // Actual implementations
    function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
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

    // --- GENERIC LOCAL STORAGE FUNCTIONS --- (Same)
    function saveData(key, data) { /* ... */ }
    function loadData(key, dateParserFn) { /* ... */ }
    // Actual implementations
    function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data));}
    function loadData(key, dateParserFn) {
        const storedData = localStorage.getItem(key);
        if (storedData) { 
            try {
                const parsedItems = JSON.parse(storedData);
                if (Array.isArray(parsedItems)) { return parsedItems.map(item => dateParserFn(item)); } 
                else { return []; }
            } catch (e) { return []; }
        }
        return [];
    }
    
    // --- MODAL CONTROL FUNCTIONS --- (openEditModal modified)
    function closeModal() { editTaskModal.style.display = 'none'; }
    function openEditModal(taskId) {
        // This check is important: if a drag operation just concluded and updated data,
        // we don't want the click that FINISHED the drag to also open the modal.
        // isActualDrag should be false by the time a clean click event fires.
        if (isActualDrag) { 
            // isActualDrag is reset at the end of handleDragEnd. A normal click won't set it.
            return;
        }
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        // ... (rest of openEditModal same as before)
        editTaskIdInput.value = task.id;
        editJobNameInput.value = task.name;
        editWorkerSelect.value = task.workerId;
        editJobTypeSelect.value = task.jobType || (jobTypes.length > 0 ? jobTypes[0].name : ''); 
        editStartDateInput.value = formatDate(task.startDate); 
        editDurationInput.value = task.duration;
        editTaskModal.style.display = 'block';
    }
    function closeLeaveModal() { editLeaveModal.style.display = 'none'; }
    function openEditLeaveModal(leaveId) { /* ... same ... */ }
    // Actual implementation
     function openEditLeaveModal(leaveId) {
        const leave = leaves.find(l => l.id === leaveId);
        if (!leave) return;
        const worker = workers.find(w => w.id === leave.workerId);
        editLeaveIdInput.value = leave.id;
        editLeaveWorkerDisplay.value = worker ? worker.name : 'Unknown Worker'; 
        editLeaveStartDateInput.value = formatDate(leave.startDate); 
        editLeaveEndDateInput.value = formatDate(leave.endDate);   
        editLeaveReasonInput.value = leave.reason || '';
        editLeaveModal.style.display = 'block';
    }


    // --- POPULATION FUNCTIONS --- (Same)
    function populateWorkerSelects() { /* ... */ }
    function populateJobTypeSelects() { /* ... */ }
     // Actual implementations
    function populateWorkerSelects() {
        workerSelect.innerHTML = ''; 
        editWorkerSelect.innerHTML = '';
        leaveWorkerSelect.innerHTML = ''; 
        workers.forEach(worker => {
            const option = document.createElement('option');
            option.value = worker.id;
            option.textContent = worker.name;
            workerSelect.appendChild(option.cloneNode(true));
            editWorkerSelect.appendChild(option.cloneNode(true));
            leaveWorkerSelect.appendChild(option.cloneNode(true)); 
        });
    }
    function populateJobTypeSelects() {
        jobTypeSelect.innerHTML = ''; 
        editJobTypeSelect.innerHTML = ''; 
        jobTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.name;
            option.textContent = type.name;
            jobTypeSelect.appendChild(option.cloneNode(true));
            editJobTypeSelect.appendChild(option.cloneNode(true));
        });
    }


    // --- RENDERING FUNCTIONS ---
    function renderBarOnChart(item, cellsDiv, periodStartDate, daysInPeriod, currentCellWidth, type) {
        // ... (Date calculation logic same as before) ...
        const itemStartDate = new Date(item.startDate); 
        itemStartDate.setHours(0,0,0,0); 
        const itemEndDate = new Date(item.endDate);   
        itemEndDate.setHours(23,59,59,999); 
        const periodViewEndDate = addDays(new Date(periodStartDate), daysInPeriod - 1);
        periodViewEndDate.setHours(23,59,59,999); 
        if (itemEndDate < periodStartDate || itemStartDate > periodViewEndDate) { return; }
        let renderStartIndexInPeriod = 0;
        if (itemStartDate > periodStartDate) {
            const diffTime = itemStartDate.getTime() - periodStartDate.getTime(); 
            renderStartIndexInPeriod = Math.round(diffTime / (1000 * 60 * 60 * 24));
        }
        let renderEndIndexInPeriod = daysInPeriod - 1;
        if (itemEndDate < periodViewEndDate) {
            const diffTime = itemEndDate.getTime() - periodStartDate.getTime(); 
            renderEndIndexInPeriod = Math.round(diffTime / (1000 * 60 * 60 * 24));
        }
        renderEndIndexInPeriod = Math.min(renderEndIndexInPeriod, daysInPeriod - 1);
        const offsetDays = renderStartIndexInPeriod;
        const durationInView = renderEndIndexInPeriod - renderStartIndexInPeriod + 1;
        if (durationInView <= 0) return;

        const barElement = document.createElement('div');
        barElement.dataset.id = String(item.id);

        if (type === 'task') {
            barElement.classList.add('task-bar');
            barElement.addEventListener('mousedown', (e) => handleDragStart(e, item.id, barElement));
            barElement.addEventListener('mousemove', (e) => { /* ... (cursor change logic same) ... */ 
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
            barElement.addEventListener('click', (e) => {
                // The primary guard is now in handleDragEnd not modifying data for a click,
                // and openEditModal having its own check if needed (though isActualDrag should be sufficient).
                openEditModal(item.id);
            });
            // ... (rest of task styling and info same as before) ...
            const assignedWorker = workers.find(w => w.id === item.workerId);
            if (assignedWorker) { barElement.style.backgroundColor = assignedWorker.color; }
            else { barElement.style.backgroundColor = "#cccccc"; }
            const jobTypeData = jobTypes.find(jt => jt.name === item.jobType);
            if (jobTypeData) {
                barElement.style.outlineColor = jobTypeData.outlineColor;
                barElement.style.setProperty('--hover-glow-color', jobTypeData.glowColor); 
            } else { barElement.style.outlineColor = '#888'; }
            barElement.textContent = `${item.name} (${item.duration}d)`;
            barElement.title = `Job: ${item.name}\nType: ${item.jobType || 'N/A'}\nWorker: ${assignedWorker ? assignedWorker.name : 'Unknown'}\nStart: ${formatDate(item.startDate)}\nEnd: ${formatDate(item.endDate)}\nDuration: ${item.duration} days`;

        } else if (type === 'leave') {
             // ... (leave rendering same as before) ...
            barElement.classList.add('leave-bar');
            barElement.textContent = item.reason ? item.reason : "On Leave"; 
            const workerOnLeave = workers.find(w => w.id === item.workerId);
            barElement.title = `On Leave: ${workerOnLeave ? workerOnLeave.name : 'Unknown'}\nStart: ${formatDate(item.startDate)}\nEnd: ${formatDate(item.endDate)}\nReason: ${item.reason || 'N/A'}`;
            barElement.addEventListener('click', () => openEditLeaveModal(item.id));
        }
        
        barElement.style.left = `${offsetDays * currentCellWidth}px`;
        barElement.style.width = `${durationInView * currentCellWidth - 2}px`; 
        cellsDiv.appendChild(barElement);
    }

    function renderGanttChart() { /* ... (Same as previous version) ... */ }
    // Actual implementation (copied from previous correct version)
    function renderGanttChart() {
        if (!ganttTimelineHeaderDiv || !ganttBodyDiv || !currentPeriodSpan || !chartFocusTitleSpan) {
            console.error("Critical DOM elements for Gantt chart not found! Cannot render.");
            return;
        }
        ganttTimelineHeaderDiv.innerHTML = '';
        ganttBodyDiv.innerHTML = '';
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
        // const cellWidth is a global const now
        for (let i = 0; i < daysInView; i++) {
            const dayDate = addDays(new Date(firstDayOfView), i);
            const dayCell = document.createElement('div');
            dayCell.classList.add('gantt-day-header');
            dayCell.textContent = formatDate(dayDate, false); 
            dayCell.title = dayDate.toLocaleDateString(); 
            if (dayDate.getDay() === 0) dayCell.classList.add('gantt-day-sunday'); 
            ganttTimelineHeaderDiv.appendChild(dayCell);
        }
        ganttTimelineHeaderDiv.style.minWidth = `${daysInView * cellWidth}px`;
        if (!workers || workers.length === 0) return;
        workers.forEach((worker) => {
            try {
                const workerRow = document.createElement('div'); workerRow.classList.add('gantt-worker-row');
                const workerNameCell = document.createElement('div'); workerNameCell.classList.add('gantt-worker-name'); workerNameCell.textContent = worker.name; workerRow.appendChild(workerNameCell);
                const cellsDiv = document.createElement('div'); cellsDiv.classList.add('gantt-cells'); cellsDiv.style.minWidth = `${daysInView * cellWidth}px`;
                for (let i = 0; i < daysInView; i++) { 
                    const cellDate = addDays(new Date(firstDayOfView), i);
                    const cell = document.createElement('div'); cell.classList.add('gantt-cell');
                    if (cellDate.getDay() === 0) cell.classList.add('gantt-cell-sunday');
                    cellsDiv.appendChild(cell);
                }
                workerRow.appendChild(cellsDiv);
                ganttBodyDiv.appendChild(workerRow);
                const workerTasks = tasks.filter(task => task && task.workerId === worker.id);
                workerTasks.forEach(task => { renderBarOnChart(task, cellsDiv, firstDayOfView, daysInView, cellWidth, 'task'); });
                const workerLeaves = leaves.filter(leave => leave && leave.workerId === worker.id);
                workerLeaves.forEach(leave => { renderBarOnChart(leave, cellsDiv, firstDayOfView, daysInView, cellWidth, 'leave'); });
            } catch (e) { console.error(`Error processing worker ${worker.name}:`, e); }
        });
    }


    // --- DRAG AND DROP HANDLER FUNCTIONS --- MODIFIED
    function handleDragStart(event, taskIdNum, element) { 
        const taskId = Number(taskIdNum);
        if (event.button !== 0 || editTaskModal.style.display === 'block' || editLeaveModal.style.display === 'block') {
            return;
        }
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        event.preventDefault(); 
        isActualDrag = false; // Initialize isActualDrag flag

        const rect = element.getBoundingClientRect();
        const mouseXInElement = event.clientX - rect.left;

        if (mouseXInElement < resizeHandleActiveZone) {
            dragMode = 'resize-left';
            document.body.style.cursor = 'ew-resize';
        } else if (mouseXInElement > element.offsetWidth - resizeHandleActiveZone) {
            dragMode = 'resize-right';
            document.body.style.cursor = 'ew-resize';
        } else {
            dragMode = 'move';
            document.body.style.cursor = 'grabbing';
        }
        
        draggedTaskElement = element;
        draggedTaskId = taskId;
        dragStartX = event.clientX; 
        originalTaskLeft = element.offsetLeft; 
        originalTaskWidth = element.offsetWidth;
        originalTaskStartDate = new Date(task.startDate); 
        originalTaskDuration = task.duration;

        element.classList.add('dragging'); 

        document.addEventListener('mousemove', handleDragging);
        document.addEventListener('mouseup', handleDragEnd);
    }

    function handleDragging(event) { 
        if (!dragMode || !draggedTaskElement) return;
        event.preventDefault();

        const dx = event.clientX - dragStartX;
        if (Math.abs(dx) > 3) { // A small threshold to confirm it's a drag
            isActualDrag = true;
        }

        if (dragMode === 'move') {
            // ... (move logic same as before) ...
            let newLeft = originalTaskLeft + dx;
            const dayIndex = Math.round(newLeft / cellWidth);
            newLeft = dayIndex * cellWidth;
            const maxLeft = (14 * cellWidth) - draggedTaskElement.offsetWidth; // 14 is daysInView
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            draggedTaskElement.style.left = `${newLeft}px`;
        } else if (dragMode === 'resize-left') {
            // ... (resize-left logic same as before) ...
            let newLeft = originalTaskLeft + dx;
            let newWidth = originalTaskWidth - dx;
            const dayIndex = Math.round(newLeft / cellWidth);
            const snappedNewLeft = dayIndex * cellWidth;
            newWidth += (originalTaskLeft - snappedNewLeft); 
            newLeft = snappedNewLeft;
            const minPixelWidth = cellWidth; 
            if (newWidth < minPixelWidth) {
                newWidth = minPixelWidth;
                newLeft = (originalTaskLeft + originalTaskWidth) - minPixelWidth; 
            }
            newLeft = Math.max(0, newLeft);
            if (newLeft + newWidth > 14 * cellWidth) {
                 newWidth = (14 * cellWidth) - newLeft;
            }
            draggedTaskElement.style.left = `${newLeft}px`;
            draggedTaskElement.style.width = `${newWidth}px`;
        } else if (dragMode === 'resize-right') {
            // ... (resize-right logic same as before) ...
            let newWidth = originalTaskWidth + dx;
            const numDays = Math.round(newWidth / cellWidth);
            newWidth = numDays * cellWidth;
            const minPixelWidth = cellWidth;
            newWidth = Math.max(minPixelWidth, newWidth);
            const maxPossibleWidth = (14 * cellWidth) - originalTaskLeft;
            newWidth = Math.min(newWidth, maxPossibleWidth);
            draggedTaskElement.style.width = `${newWidth}px`;
        }
    }

    function handleDragEnd(event) { 
        if (!dragMode || !draggedTaskElement || draggedTaskId === null) {
             // If dragMode was not even set, cleanup just in case and exit
            document.body.style.cursor = '';
            if(draggedTaskElement) draggedTaskElement.classList.remove('dragging');
            document.removeEventListener('mousemove', handleDragging);
            document.removeEventListener('mouseup', handleDragEnd);
            dragMode = null;
            draggedTaskElement = null;
            isActualDrag = false;
            return;
        }
        event.preventDefault();

        // Store current dragMode before resetting globals, for the click check
        const currentDragMode = dragMode; 
        
        // --- Perform data update only if it was an actual drag or a resize operation ---
        let dataChanged = false;
        if (isActualDrag || currentDragMode === 'resize-left' || currentDragMode === 'resize-right') {
            const taskIndex = tasks.findIndex(t => t.id === draggedTaskId);
            if (taskIndex !== -1) {
                const task = tasks[taskIndex];
                const finalLeftPixels = parseFloat(draggedTaskElement.style.left);
                const finalWidthPixels = parseFloat(draggedTaskElement.style.width);

                if (currentDragMode === 'move') {
                    const daysOffset = Math.round((finalLeftPixels - originalTaskLeft) / cellWidth);
                    if (daysOffset !== 0) { // Only update if there was a change
                        task.startDate = addDays(new Date(originalTaskStartDate), daysOffset);
                        task.endDate = addDays(new Date(task.startDate), task.duration - 1);
                        dataChanged = true;
                    }
                } else if (currentDragMode === 'resize-left') {
                    const daysShiftedForStart = Math.round((finalLeftPixels - originalTaskLeft) / cellWidth);
                    const newStartDate = addDays(new Date(originalTaskStartDate), daysShiftedForStart);
                    const originalEndDate = addDays(new Date(originalTaskStartDate), originalTaskDuration -1);
                    let newDuration = Math.round((originalEndDate.getTime() - newStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    newDuration = Math.max(1, newDuration); 
                    
                    if (task.startDate.getTime() !== newStartDate.getTime() || task.duration !== newDuration) {
                        task.startDate = newStartDate;
                        task.duration = newDuration;
                        task.endDate = addDays(new Date(task.startDate), task.duration - 1);
                        dataChanged = true;
                    }
                } else if (currentDragMode === 'resize-right') {
                    let newDuration = Math.round(finalWidthPixels / cellWidth);
                    newDuration = Math.max(1, newDuration); 
                    if (task.duration !== newDuration) {
                        task.duration = newDuration;
                        task.endDate = addDays(new Date(task.startDate), task.duration - 1); 
                        dataChanged = true;
                    }
                }
                if (dataChanged) {
                    saveData('workshopTasks', tasks);
                }
            }
        }

        // --- Cleanup ---
        if (draggedTaskElement) {
            draggedTaskElement.classList.remove('dragging');
            draggedTaskElement.style.cursor = 'grab'; 
        }
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', handleDragging);
        document.removeEventListener('mouseup', handleDragEnd);
        
        // Reset global drag state AFTER checking currentDragMode and isActualDrag
        dragMode = null; 
        draggedTaskElement = null;
        draggedTaskId = null;
        // isActualDrag is reset at the start of handleDragStart for the next operation

        if (dataChanged) {
            renderGanttChart(); // Re-render only if data actually changed
        }
    }

    // --- EVENT HANDLER FUNCTIONS (TASK & LEAVE MANAGEMENT, TIMELINE) --- (Same as before)
    // ... (Full implementations of handleAddTask, handleEditTask, etc. copied from previous correct version)
    function handleAddTask(event) {
        event.preventDefault();
        const jobName = document.getElementById('jobName').value;
        const workerId = parseInt(workerSelect.value);
        const jobType = jobTypeSelect.value; 
        const startDateStr = document.getElementById('startDate').value;
        const startDate = new Date(startDateStr + "T00:00:00");
        const duration = parseInt(document.getElementById('duration').value);
        if (!jobName || !workerId || !jobType || !startDateStr || isNaN(startDate.getTime()) || duration < 1) { alert("Please fill in all fields correctly, including Job Type. Ensure start date is valid."); return; }
        const endDate = addDays(new Date(startDate), duration - 1);
        const newTask = { id: Date.now(), name: jobName, workerId: workerId, jobType: jobType, startDate: startDate, duration: duration, endDate: endDate };
        tasks.push(newTask);
        saveData('workshopTasks', tasks);
        renderGanttChart();
        addJobForm.reset(); 
        document.getElementById('startDate').value = formatDate(new Date());
    }
    function handleEditTask(event) {
        event.preventDefault();
        const taskId = parseInt(editTaskIdInput.value);
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;
        const newJobType = editJobTypeSelect.value; 
        const startDateStr = editStartDateInput.value;
        const newStartDate = new Date(startDateStr + "T00:00:00");
        const newDuration = parseInt(editDurationInput.value);
        if (!editJobNameInput.value || isNaN(parseInt(editWorkerSelect.value)) || !newJobType || !startDateStr || isNaN(newStartDate.getTime()) || newDuration < 1) { alert("Please fill in all fields correctly in the edit form, including Job Type. Ensure start date is valid."); return; }
        tasks[taskIndex].name = editJobNameInput.value;
        tasks[taskIndex].workerId = parseInt(editWorkerSelect.value);
        tasks[taskIndex].jobType = newJobType; 
        tasks[taskIndex].startDate = newStartDate;
        tasks[taskIndex].duration = newDuration;
        tasks[taskIndex].endDate = addDays(new Date(newStartDate), newDuration - 1);
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
    function init() { /* ... */ }
    // Actual implementation
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
        document.getElementById('startDate').value = formatDate(new Date()); 
        leaveStartDateInput.value = formatDate(new Date()); 
        leaveEndDateInput.value = formatDate(new Date()); 
        renderGanttChart(); 
    }

    // --- START THE APP ---
    init();
});