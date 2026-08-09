const tasksList = document.querySelector("#tasks-list");
const emptyState = document.querySelector("#empty-state");
const totalTasksElement = document.querySelector("#total-tasks");
const completedTasksElement = document.querySelector("#completed-tasks");
const pendingTasksElement = document.querySelector("#pending-tasks");
const themeToggle = document.querySelector(".theme-toggle");
const addTaskButton = document.querySelector("#add-task-btn");
const emptyAddButton = document.querySelector("#empty-add-btn");
const filterButtons = document.querySelectorAll(".filter-button");

const monthSelect = document.querySelector("#filter-month");
const yearSelect = document.querySelector("#filter-year");
const clearDateFilterButton = document.querySelector("#clear-date-filter");

const chartViewSelect = document.querySelector("#chart-view");
const chartCanvas = document.querySelector("#stats-chart");
const chartEmptyMessage = document.querySelector("#chart-empty");

const taskModal = document.querySelector("#task-modal");
const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskDateInput = document.querySelector("#task-date");
const taskError = document.querySelector("#task-error");
const taskCancelButton = document.querySelector("#task-cancel");

const confirmModal = document.querySelector("#confirm-modal");
const confirmModalText = document.querySelector("#confirm-modal-text");
const confirmCancelButton = document.querySelector("#confirm-cancel");
const confirmDeleteButton = document.querySelector("#confirm-delete");

const TASKS_STORAGE_KEY = "taskflow-tasks";
const THEME_STORAGE_KEY = "taskflow-theme";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MONTH_SHORT_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

let tasks = [];
let currentFilter = "all";
let taskPendingDeleteId = null;
let chartInstance = null;

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function parseTaskDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function formatDate(dateStr) {
  return parseTaskDate(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function loadTasks() {
  const savedTasks = localStorage.getItem(TASKS_STORAGE_KEY);

  if (!savedTasks) {
    return;
  }

  try {
    tasks = JSON.parse(savedTasks);
  } catch (error) {
    console.error("Não foi possível carregar as tarefas:", error);
    tasks = [];
  }
}

function saveTasks() {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

function generateId() {
  return Date.now() + Math.random().toString(16).slice(2);
}

function createTask(title, date) {
  const newTask = {
    id: generateId(),
    title: title,
    date: date || todayIso(),
    completed: false,
    createdAt: new Date().toISOString(),
  };

  tasks.unshift(newTask);
  saveTasks();
  refreshYearOptions();
  renderTasks();
}

function deleteTask(taskId) {
  tasks = tasks.filter((item) => item.id !== taskId);
  saveTasks();
  refreshYearOptions();
  renderTasks();
}

function toggleTask(taskId) {
  tasks = tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );

  saveTasks();
  renderTasks();
}

function getFilteredTasks() {
  return tasks.filter((task) => {
    if (currentFilter === "completed" && !task.completed) return false;
    if (currentFilter === "pending" && task.completed) return false;

    if (task.date) {
      const taskDate = parseTaskDate(task.date);

      if (monthSelect.value !== "all" && taskDate.getMonth() + 1 !== Number(monthSelect.value)) {
        return false;
      }

      if (yearSelect.value !== "all" && taskDate.getFullYear() !== Number(yearSelect.value)) {
        return false;
      }
    }

    return true;
  });
}

function createTaskElement(task) {
  const article = document.createElement("article");
  article.classList.add("task-card");

  if (task.completed) {
    article.classList.add("completed");
  }

  const checkbox = document.createElement("button");
  checkbox.type = "button";
  checkbox.classList.add("task-checkbox");
  checkbox.setAttribute(
    "aria-label",
    task.completed ? "Marcar como pendente" : "Marcar como concluída"
  );

  if (task.completed) {
    checkbox.textContent = "✓";
  }

  checkbox.addEventListener("click", () => toggleTask(task.id));

  const content = document.createElement("div");
  content.classList.add("task-content");

  const title = document.createElement("h3");
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.classList.add("task-meta");

  const status = document.createElement("span");
  status.classList.add("task-status");
  status.textContent = task.completed ? "Concluída" : "Pendente";
  meta.appendChild(status);

  if (task.date) {
    const dateBadge = document.createElement("span");
    dateBadge.classList.add("task-date");
    dateBadge.textContent = formatDate(task.date);
    meta.appendChild(dateBadge);
  }

  content.appendChild(title);
  content.appendChild(meta);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.classList.add("delete-task");
  deleteButton.textContent = "Excluir";
  deleteButton.setAttribute("aria-label", `Excluir tarefa: ${task.title}`);
  deleteButton.addEventListener("click", () => openConfirmModal(task));

  article.appendChild(checkbox);
  article.appendChild(content);
  article.appendChild(deleteButton);

  return article;
}

function renderTasks() {
  tasksList.innerHTML = "";

  const filteredTasks = getFilteredTasks();

  filteredTasks.forEach((task) => {
    tasksList.appendChild(createTaskElement(task));
  });

  updateEmptyState(filteredTasks);
  updateStatistics();
  updateChart();
}

function updateEmptyState(filteredTasks) {
  emptyState.style.display = filteredTasks.length === 0 ? "block" : "none";
}

function updateStatistics() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.filter((task) => !task.completed).length;

  totalTasksElement.textContent = total;
  completedTasksElement.textContent = completed;
  pendingTasksElement.textContent = pending;
}

function populateMonthOptions() {
  monthSelect.innerHTML =
    '<option value="all">Todos os meses</option>' +
    MONTH_NAMES.map((name, index) => `<option value="${index + 1}">${name}</option>`).join("");
}

function refreshYearOptions() {
  const years = new Set(tasks.filter((task) => task.date).map((task) => parseTaskDate(task.date).getFullYear()));
  years.add(new Date().getFullYear());

  const sortedYears = Array.from(years).sort((a, b) => b - a);
  const previousValue = yearSelect.value;

  yearSelect.innerHTML =
    '<option value="all">Todos os anos</option>' +
    sortedYears.map((year) => `<option value="${year}">${year}</option>`).join("");

  yearSelect.value = sortedYears.includes(Number(previousValue)) ? previousValue : "all";
}

function getCssVariable(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function updateChart() {
  if (typeof Chart === "undefined") {
    return;
  }

  const view = chartViewSelect.value;
  const primaryColor = getCssVariable("--color-primary");
  const accentColor = getCssVariable("--color-accent");
  const textColor = getCssVariable("--color-ink-muted");
  const gridColor = getCssVariable("--color-border");

  let hasData = tasks.length > 0;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: textColor, font: { family: "Inter" }, usePointStyle: true },
      },
    },
  };

  if (view === "status") {
    const completed = tasks.filter((task) => task.completed).length;
    const pending = tasks.length - completed;

    chartInstance = new Chart(chartCanvas, {
      type: "doughnut",
      data: {
        labels: ["Concluídas", "Pendentes"],
        datasets: [
          {
            data: [completed, pending],
            backgroundColor: [primaryColor, accentColor],
            borderWidth: 0,
          },
        ],
      },
      options: { ...baseOptions, cutout: "68%" },
    });
  }

  if (view === "month") {
    const year = yearSelect.value === "all" ? new Date().getFullYear() : Number(yearSelect.value);
    const completedCounts = new Array(12).fill(0);
    const pendingCounts = new Array(12).fill(0);

    tasks.forEach((task) => {
      if (!task.date) return;
      const date = parseTaskDate(task.date);
      if (date.getFullYear() !== year) return;

      if (task.completed) {
        completedCounts[date.getMonth()] += 1;
      } else {
        pendingCounts[date.getMonth()] += 1;
      }
    });

    hasData = completedCounts.some((count) => count > 0) || pendingCounts.some((count) => count > 0);

    chartInstance = new Chart(chartCanvas, {
      type: "bar",
      data: {
        labels: MONTH_SHORT_NAMES,
        datasets: [
          { label: "Concluídas", data: completedCounts, backgroundColor: primaryColor, borderRadius: 4, maxBarThickness: 28 },
          { label: "Pendentes", data: pendingCounts, backgroundColor: accentColor, borderRadius: 4, maxBarThickness: 28 },
        ],
      },
      options: {
        ...baseOptions,
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
        },
      },
    });
  }

  if (view === "year") {
    const years = Array.from(
      new Set(tasks.filter((task) => task.date).map((task) => parseTaskDate(task.date).getFullYear()))
    ).sort((a, b) => a - b);

    hasData = years.length > 0;

    const counts = years.map(
      (year) => tasks.filter((task) => task.date && parseTaskDate(task.date).getFullYear() === year).length
    );

    chartInstance = new Chart(chartCanvas, {
      type: "bar",
      data: {
        labels: years,
        datasets: [{ label: "Tarefas", data: counts, backgroundColor: primaryColor, borderRadius: 4, maxBarThickness: 40 }],
      },
      options: {
        ...baseOptions,
        plugins: { ...baseOptions.plugins, legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
        },
      },
    });
  }

  chartCanvas.style.display = hasData ? "block" : "none";
  chartEmptyMessage.hidden = hasData;
}

function openTaskModal() {
  taskError.classList.remove("visible");
  taskInput.value = "";
  taskDateInput.value = todayIso();
  taskModal.hidden = false;
  taskInput.focus();
}

function closeTaskModal() {
  taskModal.hidden = true;
}

function openConfirmModal(task) {
  taskPendingDeleteId = task.id;
  confirmModalText.textContent = `Deseja excluir a tarefa "${task.title}"? Essa ação não pode ser desfeita.`;
  confirmModal.hidden = false;
}

function closeConfirmModal() {
  confirmModal.hidden = true;
  taskPendingDeleteId = null;
}

addTaskButton.addEventListener("click", openTaskModal);
emptyAddButton.addEventListener("click", openTaskModal);
taskCancelButton.addEventListener("click", closeTaskModal);

taskModal.addEventListener("click", (event) => {
  if (event.target === taskModal) {
    closeTaskModal();
  }
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const cleanTitle = taskInput.value.trim();

  if (!cleanTitle) {
    taskError.classList.add("visible");
    taskInput.focus();
    return;
  }

  createTask(cleanTitle, taskDateInput.value);
  closeTaskModal();
});

confirmCancelButton.addEventListener("click", closeConfirmModal);

confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) {
    closeConfirmModal();
  }
});

confirmDeleteButton.addEventListener("click", () => {
  if (taskPendingDeleteId !== null) {
    deleteTask(taskPendingDeleteId);
  }

  closeConfirmModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!taskModal.hidden) {
      closeTaskModal();
    }

    if (!confirmModal.hidden) {
      closeConfirmModal();
    }
  }

  if (event.ctrlKey && event.key.toLowerCase() === "n") {
    event.preventDefault();
    openTaskModal();
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderTasks();
  });
});

monthSelect.addEventListener("change", renderTasks);
yearSelect.addEventListener("change", renderTasks);

clearDateFilterButton.addEventListener("click", () => {
  monthSelect.value = "all";
  yearSelect.value = "all";
  renderTasks();
});

chartViewSelect.addEventListener("change", updateChart);

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);

  if (themeToggle) {
    themeToggle.textContent = isDark ? "☀️" : "🌙";
    themeToggle.setAttribute(
      "aria-label",
      isDark ? "Ativar tema claro" : "Ativar tema escuro"
    );
  }
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark-theme");
  const newTheme = isDark ? "light" : "dark";

  applyTheme(newTheme);
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  updateChart();
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme) {
    applyTheme(savedTheme);
    return;
  }

  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  applyTheme(prefersDark ? "dark" : "light");
}

if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
}

function init() {
  populateMonthOptions();
  loadTasks();
  refreshYearOptions();
  loadTheme();
  renderTasks();
}

init();
