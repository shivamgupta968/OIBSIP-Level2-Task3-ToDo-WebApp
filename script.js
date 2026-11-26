const STORAGE_KEY = "taskflow_tasks_v1";
const $ = (selector) => document.querySelector(selector);

const form = $("#taskForm");
const taskInput = $("#taskInput");
const priorityInput = $("#priorityInput");
const pendingList = $("#pendingList");
const completedList = $("#completedList");
const formError = $("#formError");
const editDialog = $("#editDialog");
const editForm = $("#editForm");
const editInput = $("#editInput");
const toast = $("#toast");

let tasks = loadTasks();
let activeFilter = "all";
let editingId = null;
let toastTimer;

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(task =>
      task && typeof task.id === "string" && typeof task.text === "string"
    ) : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    showToast("Could not save tasks in this browser.");
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function makeTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task-item";
  item.dataset.id = task.id;
  item.innerHTML = `
    <button class="check-btn" type="button" data-action="toggle" aria-label="${task.completed ? "Move to pending" : "Mark complete"}">${task.completed ? "✓" : ""}</button>
    <div class="task-copy">
      <div class="task-text">${escapeHTML(task.text)}</div>
      <div class="task-meta"><span class="priority ${task.priority}">${escapeHTML(task.priority)} priority</span><span>Added ${formatDate(task.createdAt)}</span></div>
    </div>
    <div class="task-actions">
      <button class="icon-btn" type="button" data-action="edit" aria-label="Edit task" title="Edit">✎</button>
      <button class="icon-btn delete" type="button" data-action="delete" aria-label="Delete task" title="Delete">×</button>
    </div>`;
  return item;
}

function render() {
  pendingList.replaceChildren();
  completedList.replaceChildren();

  const pending = tasks.filter(task => !task.completed);
  const completed = tasks.filter(task => task.completed);
  const visiblePending = activeFilter === "completed" ? [] : pending;
  const visibleCompleted = activeFilter === "pending" ? [] : completed;

  visiblePending.forEach(task => pendingList.append(makeTaskElement(task)));
  visibleCompleted.forEach(task => completedList.append(makeTaskElement(task)));

  $("#pendingEmpty").classList.toggle("hidden", visiblePending.length > 0 || activeFilter === "completed");
  $("#completedEmpty").classList.toggle("hidden", visibleCompleted.length > 0 || activeFilter === "pending");
  $("#pendingList").classList.toggle("hidden", activeFilter === "completed");
  $("#completedList").classList.toggle("hidden", activeFilter === "pending");

  $("#allCount").textContent = tasks.length;
  $("#pendingCount").textContent = pending.length;
  $("#completedCount").textContent = completed.length;
  $("#pendingHeadingCount").textContent = pending.length;
  $("#completedHeadingCount").textContent = completed.length;

  const percent = tasks.length ? Math.round(completed.length / tasks.length * 100) : 0;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;
  $("#progressCaption").textContent = tasks.length
    ? `${completed.length} of ${tasks.length} tasks completed. ${percent === 100 ? "Amazing work — you did it!" : "Keep your momentum going."}`
    : "Your day is a blank canvas. Let's get started.";

  document.querySelectorAll(".filter").forEach(button => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) {
    formError.textContent = "Please enter a task before adding it.";
    taskInput.focus();
    return;
  }
  if (text.length > 120) {
    formError.textContent = "Task must be 120 characters or fewer.";
    return;
  }
  tasks.unshift({
    id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    text,
    priority: priorityInput.value,
    completed: false,
    createdAt: Date.now()
  });
  saveTasks();
  form.reset();
  priorityInput.value = "medium";
  formError.textContent = "";
  activeFilter = "all";
  render();
  taskInput.focus();
  showToast("Task added to your list.");
});

document.querySelector(".filters").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  render();
});

function handleListAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const item = button.closest(".task-item");
  const task = tasks.find(entry => entry.id === item?.dataset.id);
  if (!task) return;

  switch (button.dataset.action) {
    case "toggle":
      task.completed = !task.completed;
      task.completedAt = task.completed ? Date.now() : null;
      saveTasks();
      render();
      showToast(task.completed ? "Nice work — task completed!" : "Task moved back to pending.");
      break;
    case "edit":
      editingId = task.id;
      editInput.value = task.text;
      editDialog.showModal();
      editInput.focus();
      editInput.select();
      break;
    case "delete":
      if (!window.confirm(`Delete "${task.text}"?`)) return;
      tasks = tasks.filter(entry => entry.id !== task.id);
      saveTasks();
      render();
      showToast("Task deleted.");
      break;
  }
}

pendingList.addEventListener("click", handleListAction);
completedList.addEventListener("click", handleListAction);

editForm.addEventListener("submit", event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const updatedText = editInput.value.trim();
  if (!updatedText) {
    editInput.setCustomValidity("Task name cannot be empty.");
    editInput.reportValidity();
    return;
  }
  editInput.setCustomValidity("");
  const task = tasks.find(entry => entry.id === editingId);
  if (task) {
    task.text = updatedText;
    saveTasks();
    render();
    showToast("Task updated.");
  }
  editingId = null;
  editDialog.close();
});

editInput.addEventListener("input", () => editInput.setCustomValidity(""));
editDialog.addEventListener("close", () => { editingId = null; });

$("#todayLabel").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long", month: "long", day: "numeric"
}).format(new Date());

render();
