(() => {
  const apiEndpoints = [
    { endpoint: "/", method: "GET", auth: "Cookie (Session)", description: 'Serves captive portal <span class="inline-tag">login.html</span> or <span class="inline-tag">dashboard.html</span>' },
    { endpoint: "/api/telemetry", method: "GET", auth: "Cookie (Session)", description: "Device time, WiFi mode, sniffer status, and connection state" },
    { endpoint: "/api/schedule", method: "GET / POST", auth: "Cookie (Session)", description: "Fetches or updates JSON schedule configuration (chunk-safe)" },
    { endpoint: "/api/attendance", method: "GET", auth: "Cookie (Session)", description: 'Downloads parsed attendance logs from <span class="inline-tag">/data/logs.csv</span>' },
    { endpoint: "/api/attendance/status", method: "GET", auth: "Cookie (Session)", description: "Returns current promiscuous mode / sniffer window state" },
    { endpoint: "/api/config", method: "GET / POST", auth: "Cookie (Session)", description: "Manages WiFi AP/Station credentials" },
    { endpoint: "/handleLogin", method: "POST", auth: "None", description: 'Authenticates session credentials via client <span class="inline-tag">fetch()</span>' },
    { endpoint: "/ring", method: "GET", auth: "Cookie (Session)", description: 'Pushes manual chime request to <span class="inline-tag">xAudioQueue</span>' },
    { endpoint: "/logout", method: "GET", auth: "Cookie (Session)", description: "Clears session cookie and invalidates session token" }
  ];

  const endpointTableBody = document.querySelector(".api-endpoints-table tbody");
  if (endpointTableBody) {
    endpointTableBody.innerHTML = apiEndpoints.map((api) => `
      <tr>
        <td><span class="endpoint-pill">${api.endpoint}</span></td>
        <td>${api.method}</td>
        <td>${api.auth}</td>
        <td>${api.description}</td>
      </tr>`).join("");
  }

  document.querySelectorAll(".logout a").forEach((link) => {
    link.addEventListener("click", () => localStorage.removeItem("fcuBellLoggedIn"));
  });

  const scheduleStorageKey = "fcuBellSchedules";
  const defaultSchedules = [
    { id: 1, time: "07:45 AM", description: "Flag Ceremony", audio: "anthem.mp3" },
    { id: 2, time: "08:30 AM", description: "Start of Class", audio: "bell.mp3" },
    { id: 3, time: "10:00 AM", description: "Recess", audio: "recess.mp3" },
    { id: 4, time: "03:00 PM", description: "Dismissal", audio: "dismissal.mp3" }
  ];

  const readSchedules = () => {
    try {
      return JSON.parse(localStorage.getItem(scheduleStorageKey)) || defaultSchedules;
    } catch {
      return defaultSchedules;
    }
  };

  const saveSchedules = (schedules) => localStorage.setItem(scheduleStorageKey, JSON.stringify(schedules));

  const showMessage = (message) => {
    let messageElement = document.getElementById("page-message");
    if (!messageElement) {
      messageElement = document.createElement("p");
      messageElement.id = "page-message";
      messageElement.className = "message success";
      document.querySelector(".main-content").prepend(messageElement);
    }
    messageElement.textContent = message;
  };

  const scheduleBody = document.getElementById("standalone-schedule-body");
  if (scheduleBody) {
    let schedules = readSchedules();
    const form = document.getElementById("standalone-schedule-form");
    const timeInput = document.getElementById("standalone-time");
    const descriptionInput = document.getElementById("standalone-description");
    const audioInput = document.getElementById("standalone-audio");
    const audioFileInput = document.getElementById("standalone-audio-file");
    let editingId = null;

    const render = () => {
      scheduleBody.innerHTML = schedules.length ? schedules.map((item) => `
        <tr>
          <td>${item.time}</td><td>${item.description}</td><td>${item.audio}</td>
          <td><button type="button" class="edit-schedule" data-id="${item.id}">Edit</button>
          <button type="button" class="delete-schedule delete-btn" data-id="${item.id}">Delete</button></td>
        </tr>`).join("") : '<tr><td colspan="4" class="empty-state">No bell schedules yet.</td></tr>';
      document.getElementById("schedule-count").textContent = schedules.length;
      document.getElementById("next-bell").textContent = schedules.length ? `${schedules[0].time} - ${schedules[0].description}` : "No schedule set";
      saveSchedules(schedules);
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const time = timeInput.value.trim();
      const description = descriptionInput.value.trim();
      const selectedFile = audioFileInput.files[0];
      const current = schedules.find((item) => item.id === editingId);
      const audio = selectedFile?.name || audioInput.value.trim() || current?.audio;
      if (!time || !description || !audio) {
        showMessage("Please provide a time, description, and audio file.");
        return;
      }
      const entry = { id: editingId || Date.now(), time, description, audio };
      schedules = editingId ? schedules.map((item) => item.id === editingId ? { ...item, ...entry } : item) : [...schedules, entry];
      saveSchedules(schedules);
      render();
      form.reset();
      editingId = null;
      showMessage("Schedule saved successfully.");
    });

    scheduleBody.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const id = Number(button.dataset.id);
      const item = schedules.find((entry) => entry.id === id);
      if (button.classList.contains("edit-schedule")) {
        editingId = id;
        timeInput.value = item.time;
        descriptionInput.value = item.description;
        audioInput.value = item.audio;
        timeInput.focus();
        showMessage("Editing schedule entry.");
      } else if (button.classList.contains("delete-schedule")) {
        schedules = schedules.filter((entry) => entry.id !== id);
        saveSchedules(schedules);
        render();
        showMessage("Schedule deleted successfully.");
      }
    });
    document.getElementById("cancel-schedule").addEventListener("click", () => { form.reset(); editingId = null; });
    document.getElementById("add-schedule").addEventListener("click", () => {
      form.reset();
      editingId = null;
      timeInput.focus();
    });
    render();
  }

  const userTableBody = document.getElementById("user-table-body");
  if (userTableBody) {
    const accountsStorageKey = "fcuBellAccounts";
    const userForm = document.getElementById("user-form");
    const usernameInput = document.getElementById("user-username");
    const passwordInput = document.getElementById("user-password");
    const roleInput = document.getElementById("user-role");
    const statusInput = document.getElementById("user-status");
    let users = readUsers();
    let editingUsername = null;

    function readUsers() {
      try {
        const saved = JSON.parse(localStorage.getItem(accountsStorageKey));
        if (Array.isArray(saved) && saved.length) {
          return saved.map((user) => ({
            username: String(user.username || "").trim(),
            password: String(user.password || ""),
            role: user.role || "Staff",
            status: user.status || "Active",
            lastLogin: user.lastLogin || "Never"
          })).filter((user) => user.username);
        }
      } catch {}
      return [{ username: "admin", password: "admin123", role: "Administrator", status: "Active", lastLogin: "Never" }];
    }

    function saveUsers() {
      localStorage.setItem(accountsStorageKey, JSON.stringify(users));
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
      }[character]));
    }

    function renderUsers() {
      const admins = users.filter((user) => user.role === "Administrator").length;
      const active = users.filter((user) => user.status === "Active").length;
      document.getElementById("user-count").textContent = users.length;
      document.getElementById("admin-count").textContent = admins;
      document.getElementById("active-user-count").textContent = active;
      userTableBody.innerHTML = users.length ? users.map((user) => {
        const statusClass = user.status.toLowerCase();
        const isOnlyAdministrator = user.role === "Administrator" && admins === 1;
        return `<tr>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(user.role)}</td>
          <td><span class="status-badge ${statusClass}">${escapeHtml(user.status)}</span></td>
          <td>${escapeHtml(user.lastLogin)}</td>
          <td class="user-actions">
            <button type="button" class="user-action" data-action="edit" data-username="${escapeHtml(user.username)}">Edit</button>
            <button type="button" class="user-action" data-action="toggle" data-username="${escapeHtml(user.username)}">${user.status === "Active" ? "Disable" : "Activate"}</button>
            <button type="button" class="user-action delete-btn" data-action="delete" data-username="${escapeHtml(user.username)}" ${isOnlyAdministrator ? "disabled title=\"Keep at least one administrator\"" : ""}>Delete</button>
          </td>
        </tr>`;
      }).join("") : '<tr><td colspan="5" class="empty-state">No users yet.</td></tr>';
      saveUsers();
    }

    function resetUserForm() {
      userForm.reset();
      userForm.hidden = true;
      editingUsername = null;
      passwordInput.required = false;
    }

    document.getElementById("add-user").addEventListener("click", () => {
      resetUserForm();
      userForm.hidden = false;
      passwordInput.required = true;
      usernameInput.focus();
    });

    document.getElementById("cancel-user").addEventListener("click", resetUserForm);

    userForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const duplicate = users.some((user) => user.username.toLowerCase() === username.toLowerCase() && user.username !== editingUsername);
      if (!username || duplicate) {
        showMessage(duplicate ? "That username is already in use." : "Username is required.");
        return;
      }
      if (!editingUsername && password.length < 6) {
        showMessage("Password must be at least 6 characters.");
        return;
      }
      if (editingUsername && password && password.length < 6) {
        showMessage("Password must be at least 6 characters.");
        return;
      }
      const existing = users.find((user) => user.username === editingUsername);
      const updatedUser = {
        username,
        password: password || existing?.password,
        role: roleInput.value,
        status: statusInput.value,
        lastLogin: existing?.lastLogin || "Never"
      };
      users = editingUsername ? users.map((user) => user.username === editingUsername ? updatedUser : user) : [...users, updatedUser];
      saveUsers();
      renderUsers();
      resetUserForm();
      showMessage("User saved successfully.");
    });

    userTableBody.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-username]");
      if (!button || button.disabled) return;
      const username = button.dataset.username;
      const user = users.find((entry) => entry.username === username);
      if (!user) return;
      if (button.dataset.action === "edit") {
        editingUsername = username;
        userForm.hidden = false;
        usernameInput.value = user.username;
        roleInput.value = user.role;
        statusInput.value = user.status;
        passwordInput.value = "";
        passwordInput.required = false;
        usernameInput.focus();
      } else if (button.dataset.action === "toggle") {
        user.status = user.status === "Active" ? "Inactive" : "Active";
        saveUsers();
        renderUsers();
        showMessage(`User ${user.status === "Active" ? "activated" : "disabled"} successfully.`);
      } else if (button.dataset.action === "delete" && confirm(`Delete the account for ${username}?`)) {
        users = users.filter((entry) => entry.username !== username);
        saveUsers();
        renderUsers();
        showMessage("User deleted successfully.");
      }
    });

    renderUsers();
  }
})();