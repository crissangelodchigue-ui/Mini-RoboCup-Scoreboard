
/* MINI ROBOCUP SCOREBOARD FACILITATOR CONTROL SYSTEM */

const STORAGE_KEY = "miniRoboCupScoreboardData";
const DISPLAY_KEY = "miniRoboCupDisplayData";
const CHANNEL_NAME = "miniRoboCupScoreboard";

const MAX_ATTEMPTS = 3;
const PENALTY_SECONDS = 3;


/* ELEMENTS */

const teamForm = document.getElementById("teamForm");
const newTeamName = document.getElementById("newTeamName");
const newPlayer1 = document.getElementById("newPlayer1");
const newPlayer2 = document.getElementById("newPlayer2");

const teamSelect = document.getElementById("teamSelect");
const activeTeamDetails = document.getElementById("activeTeamDetails");

const runStatus = document.getElementById("runStatus");
const attemptCount = document.getElementById("attemptCount");
const attemptsLeft = document.getElementById("attemptsLeft");
const currentAttempt = document.getElementById("currentAttempt");

const runTimer = document.getElementById("runTimer");
const timerHint = document.getElementById("timerHint");

const startRunBtn = document.getElementById("startRunBtn");
const finishRunBtn = document.getElementById("finishRunBtn");

const penaltyTotal = document.getElementById("penaltyTotal");
const penaltyButtons = document.querySelectorAll(".penalty-btn");

const declaredRestartBtn = document.getElementById("declaredRestartBtn");
const switchOperatorBtn = document.getElementById("switchOperatorBtn");

const attemptHistory = document.getElementById("attemptHistory");
const leaderboard = document.getElementById("leaderboard");

const teamCount = document.getElementById("teamCount");

const exportBtn = document.getElementById("exportBtn");
const resetAllBtn = document.getElementById("resetAllBtn");

const connectionStatus = document.getElementById("connectionStatus");
const openDisplayBtn = document.getElementById("openDisplayBtn");
const themeToggle = document.getElementById("themeToggle");


/* DATA AND STATE */

let data = loadData();

let selectedTeamId = null;
let currentRun = null;

let timerInterval = null;

let channel = null;

try {
    channel = new BroadcastChannel(CHANNEL_NAME);
} catch (error) {
    console.warn("BroadcastChannel is unavailable.", error);
}


/* DATA STRUCTURE */

function createEmptyData() {
    return {
        teams: [],
        theme: "dark",
        competitionWinner: null
    };
}


function loadData() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (!saved || !Array.isArray(saved.teams)) {
            return createEmptyData();
        }

        return {
            teams: saved.teams,
            theme: saved.theme || "dark",
            competitionWinner: saved.competitionWinner || null
        };

    } catch (error) {
        console.error("Could not load scoreboard data:", error);
        return createEmptyData();
    }
}


function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}


/* GENERAL HELPERS */

function getSelectedTeam() {
    return data.teams.find(team => team.id === selectedTeamId) || null;
}


function generateId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8);
}


function formatTime(milliseconds) {
    const total = Math.max(0, milliseconds);

    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const hundredths = Math.floor((total % 1000) / 10);

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "." +
        String(hundredths).padStart(2, "0")
    );
}


function formatSeconds(milliseconds) {
    return (milliseconds / 1000).toFixed(2);
}


function getElapsedTime() {
    if (!currentRun) return 0;

    if (currentRun.running) {
        return Date.now() - currentRun.startedAt;
    }

    return currentRun.elapsed;
}


function getAdjustedTime(attempt) {
    return attempt.elapsed + attempt.penalty;
}


function getBestAttempt(team) {
    const validAttempts = team.attempts.filter(
        attempt => attempt.status === "Completed"
    );

    if (validAttempts.length === 0) return null;

    return validAttempts.reduce((best, attempt) => {
        return getAdjustedTime(attempt) < getAdjustedTime(best)
            ? attempt
            : best;
    });
}


function getUsedAttempts(team) {
    return team.attempts.length;
}


function getRemainingAttempts(team) {
    return Math.max(0, MAX_ATTEMPTS - getUsedAttempts(team));
}


/* =====================================================
   TEAM REGISTRATION
===================================================== */

teamForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = newTeamName.value.trim();
    const player1 = newPlayer1.value.trim();
    const player2 = newPlayer2.value.trim();

    if (!name || !player1 || !player2) {
        alert("Please complete all team information.");
        return;
    }

    const duplicate = data.teams.some(
        team => team.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
        alert("A team with that name is already registered.");
        return;
    }

    const newTeam = {
        id: generateId(),
        name,
        player1,
        player2,
        currentOperator: 1,
        attempts: []
    };

    data.teams.push(newTeam);

    selectedTeamId = newTeam.id;

    teamForm.reset();

    saveAndRender();

    alert(`${name} has been successfully registered.`);
});


/* TEAM SELECTION */

teamSelect.addEventListener("change", function () {
    if (currentRun) {
        alert("Finish or declare a restart before changing teams.");

        teamSelect.value = selectedTeamId || "";
        return;
    }

    selectedTeamId = teamSelect.value || null;

    renderAll();
    broadcastDisplay();
});


/* START RUN */

startRunBtn.addEventListener("click", function () {
    const team = getSelectedTeam();

    if (!team) {
        alert("Please select a team first.");
        return;
    }

    if (currentRun) {
        alert("A run is already in progress.");
        return;
    }

    if (getRemainingAttempts(team) <= 0) {
        alert("This team has already used all three attempts.");
        return;
    }

    currentRun = {
        teamId: team.id,
        attemptNumber: getUsedAttempts(team) + 1,
        operator: team.currentOperator,
        startedAt: Date.now(),
        elapsed: 0,
        penalty: 0,
        running: true
    };

    startTimer();

    saveAndRender();
});


/* FINISH RUN */

finishRunBtn.addEventListener("click", function () {
    if (!currentRun) {
        alert("There is no active run to finish.");
        return;
    }

    const team = data.teams.find(
        item => item.id === currentRun.teamId
    );

    if (!team) return;

    const elapsed = getElapsedTime();

    const attempt = {
        number: currentRun.attemptNumber,
        operator: currentRun.operator,
        elapsed,
        penalty: currentRun.penalty,
        status: "Completed",
        timestamp: new Date().toISOString()
    };

    team.attempts.push(attempt);

    currentRun = null;

    stopTimer();

    checkWinner();

    saveAndRender();

    alert(
        `Run recorded!\n\n` +
        `Team: ${team.name}\n` +
        `Run Time: ${formatTime(elapsed)}\n` +
        `Penalty: ${formatSeconds(attempt.penalty)} sec\n` +
        `Adjusted Time: ${formatTime(getAdjustedTime(attempt))}`
    );
});


/* PENALTY BUTTONS */

penaltyButtons.forEach(button => {

    button.addEventListener("click", function () {

        if (!currentRun || !currentRun.running) {
            alert("Penalties can only be added during an active run.");
            return;
        }

        const penalty = Number(button.dataset.penalty);

        if (!Number.isFinite(penalty) || penalty <= 0) {
            return;
        }

        currentRun.penalty += penalty * 1000;

        renderAll();
        broadcastDisplay();

    });

});


/* DECLARED RESTART */

declaredRestartBtn.addEventListener("click", function () {

    const team = getSelectedTeam();

    if (!team) {
        alert("Please select a team first.");
        return;
    }

    if (currentRun && currentRun.teamId !== team.id) {
        alert("The active run belongs to another team.");
        return;
    }

    if (getRemainingAttempts(team) <= 0) {
        alert("This team has no remaining attempts.");
        return;
    }

    const confirmed = confirm(
        "Declare a ROBOT RESTART?\n\n" +
        "This will consume one attempt without adding a time penalty."
    );

    if (!confirmed) return;

    let attemptNumber;
    let operator;

    if (currentRun) {
        attemptNumber = currentRun.attemptNumber;
        operator = currentRun.operator;

        team.attempts.push({
            number: attemptNumber,
            operator,
            elapsed: getElapsedTime(),
            penalty: currentRun.penalty,
            status: "Restarted",
            timestamp: new Date().toISOString()
        });

        currentRun = null;
        stopTimer();

    } else {
        attemptNumber = getUsedAttempts(team) + 1;
        operator = team.currentOperator;

        team.attempts.push({
            number: attemptNumber,
            operator,
            elapsed: 0,
            penalty: 0,
            status: "Restarted",
            timestamp: new Date().toISOString()
        });
    }

    checkWinner();

    saveAndRender();

    alert("Restart recorded. One attempt has been consumed.");
});


/* OPERATOR SWITCH */

switchOperatorBtn.addEventListener("click", function () {

    const team = getSelectedTeam();

    if (!team) {
        alert("Please select a team first.");
        return;
    }

    if (currentRun && currentRun.teamId !== team.id) {
        alert("The active run belongs to another team.");
        return;
    }

    if (getRemainingAttempts(team) <= 0) {
        alert("This team has no remaining attempts.");
        return;
    }

    const confirmed = confirm(
        "Switch the robot operator?\n\n" +
        "This consumes one attempt and returns the robot to the start."
    );

    if (!confirmed) return;

    const oldOperator = team.currentOperator;

    if (currentRun) {
        team.attempts.push({
            number: currentRun.attemptNumber,
            operator: currentRun.operator,
            elapsed: getElapsedTime(),
            penalty: currentRun.penalty,
            status: "Operator Switch",
            timestamp: new Date().toISOString()
        });

        currentRun = null;
        stopTimer();

    } else {
        team.attempts.push({
            number: getUsedAttempts(team) + 1,
            operator: oldOperator,
            elapsed: 0,
            penalty: 0,
            status: "Operator Switch",
            timestamp: new Date().toISOString()
        });
    }

    team.currentOperator = oldOperator === 1 ? 2 : 1;

    checkWinner();

    saveAndRender();

    alert(
        `Operator switched to Player ${team.currentOperator}.`
    );
});


/* TIMER */

function startTimer() {
    stopTimer();

    timerInterval = setInterval(() => {
        renderTimer();
        broadcastDisplay();
    }, 100);
}


function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}


function renderTimer() {
    if (!currentRun) {
        runTimer.textContent = "00:00.00";
        return;
    }

    runTimer.textContent = formatTime(getElapsedTime());

    penaltyTotal.textContent = formatSeconds(currentRun.penalty);
}


/* WINNER DETECTION */

function checkWinner() {

    if (data.teams.length === 0) {
        data.competitionWinner = null;
        return;
    }

    const allAttemptsUsed = data.teams.every(
        team => getUsedAttempts(team) >= MAX_ATTEMPTS
    );

    if (!allAttemptsUsed || currentRun) {
        data.competitionWinner = null;
        return;
    }

    const ranked = data.teams
        .map(team => ({
            team,
            best: getBestAttempt(team)
        }))
        .filter(item => item.best !== null)
        .sort((a, b) =>
            getAdjustedTime(a.best) - getAdjustedTime(b.best)
        );

    if (ranked.length === 0) {
        data.competitionWinner = {
            status: "no-valid-runs",
            teamName: "",
            time: null
        };
        return;
    }

    const fastestTime = getAdjustedTime(ranked[0].best);

    const tiedTeams = ranked.filter(
        item => getAdjustedTime(item.best) === fastestTime
    );

    if (tiedTeams.length > 1) {
        data.competitionWinner = {
            status: "tie",
            teamNames: tiedTeams.map(item => item.team.name),
            time: fastestTime
        };
        return;
    }

    data.competitionWinner = {
        status: "winner",
        teamId: ranked[0].team.id,
        teamName: ranked[0].team.name,
        time: fastestTime
    };
}


/* LEADERBOARD */

function getRankedTeams() {

    return data.teams
        .map(team => ({
            team,
            best: getBestAttempt(team)
        }))
        .sort((a, b) => {

            if (!a.best && !b.best) return 0;
            if (!a.best) return 1;
            if (!b.best) return -1;

            return getAdjustedTime(a.best) -
                getAdjustedTime(b.best);

        });
}


function renderLeaderboard() {

    const ranked = getRankedTeams();

    if (ranked.length === 0) {
        leaderboard.innerHTML = `
            <div class="empty-state">
                No registered teams yet.
            </div>
        `;
        return;
    }

    let previousTime = null;
    let previousRank = 0;

    leaderboard.innerHTML = ranked.map((item, index) => {

        const team = item.team;
        const best = item.best;

        let rank = "—";

        if (best) {
            const time = getAdjustedTime(best);

            if (time !== previousTime) {
                previousRank = index + 1;
            }

            rank = previousRank;
            previousTime = time;
        }

        const isSelected = team.id === selectedTeamId;

        return `
            <button
                type="button"
                class="leader-row ${isSelected ? "selected" : ""}"
                data-team-id="${team.id}"
                title="Click to view this team's attempts"
            >

                <span class="rank">
                    ${rank}
                </span>

                <span class="leader-team">
                    <strong>${escapeHTML(team.name)}</strong>

                    <small>
                        ${getUsedAttempts(team)}/${MAX_ATTEMPTS} attempts
                    </small>
                </span>

                <span class="leader-time">
                    ${best ? formatTime(getAdjustedTime(best)) : "NO TIME"}
                </span>

            </button>
        `;

    }).join("");


    leaderboard.querySelectorAll(".leader-row").forEach(button => {

        button.addEventListener("click", function () {

            if (currentRun) {
                alert("Finish or declare a restart before changing teams.");
                return;
            }

            selectedTeamId = button.dataset.teamId;

            renderAll();
            broadcastDisplay();

        });

    });

}


/* TEAM SELECTOR */

function renderTeamSelector() {

    teamSelect.innerHTML = `
        <option value="">Select a registered team</option>
    `;

    data.teams.forEach(team => {

        const option = document.createElement("option");

        option.value = team.id;
        option.textContent = team.name;

        if (team.id === selectedTeamId) {
            option.selected = true;
        }

        teamSelect.appendChild(option);

    });

}


/* ACTIVE TEAM DETAILS */

function renderActiveTeam() {

    const team = getSelectedTeam();

    if (!team) {

        activeTeamDetails.innerHTML = `
            <div class="eyebrow">CURRENTLY SELECTED TEAM</div>

            <h2>NO TEAM SELECTED</h2>

            <p>
                Register a team or select one from the dropdown above.
            </p>
        `;

        return;
    }

    activeTeamDetails.innerHTML = `
        <div class="eyebrow">CURRENTLY SELECTED TEAM</div>

        <h2>${escapeHTML(team.name)}</h2>

        <div class="team-player-info">
            <p>
                <strong>PLAYER 1:</strong>
                ${escapeHTML(team.player1)}
            </p>

            <p>
                <strong>PLAYER 2:</strong>
                ${escapeHTML(team.player2)}
            </p>

            <p>
                <strong>CURRENT OPERATOR:</strong>
                PLAYER ${team.currentOperator}
            </p>
        </div>

        <button
            type="button"
            class="btn btn-danger remove-team-btn"
            data-team-id="${team.id}"
        >
            REMOVE TEAM
        </button>
    `;

    const removeButton = activeTeamDetails.querySelector(
        ".remove-team-btn"
    );

    removeButton.addEventListener("click", function () {
        removeTeam(team.id);
    });

}


/* REMOVE TEAM */

function removeTeam(teamId) {

    if (currentRun && currentRun.teamId === teamId) {
        alert("You cannot remove a team with an active run.");
        return;
    }

    const team = data.teams.find(item => item.id === teamId);

    if (!team) return;

    const confirmed = confirm(
        `Remove ${team.name} and all its recorded attempts?`
    );

    if (!confirmed) return;

    data.teams = data.teams.filter(
        item => item.id !== teamId
    );

    if (selectedTeamId === teamId) {
        selectedTeamId = null;
    }

    data.competitionWinner = null;

    checkWinner();

    saveAndRender();
}


/* ATTEMPT TRACKER */

function renderAttemptTracker() {

    const team = getSelectedTeam();

    if (!team) {
        attemptCount.textContent = "0";
        attemptsLeft.textContent = "3";
        currentAttempt.textContent = "—";
        return;
    }

    attemptCount.textContent = getUsedAttempts(team);

    attemptsLeft.textContent = getRemainingAttempts(team);

    currentAttempt.textContent = currentRun &&
        currentRun.teamId === team.id
        ? currentRun.attemptNumber
        : "—";

}


/* =====================================================
   ATTEMPT HISTORY
===================================================== */

function renderAttemptHistory() {

    const team = getSelectedTeam();

    if (!team || team.attempts.length === 0) {

        attemptHistory.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    No attempt history available.
                </td>
            </tr>
        `;

        return;
    }

    attemptHistory.innerHTML = team.attempts.map(attempt => {

        const adjusted = getAdjustedTime(attempt);

        return `
            <tr>

                <td>${attempt.number}</td>

                <td>Player ${attempt.operator}</td>

                <td>${formatTime(attempt.elapsed)}</td>

                <td>${formatSeconds(attempt.penalty)} sec</td>

                <td>
                    ${attempt.status === "Completed"
                        ? formatTime(adjusted)
                        : "—"}
                </td>

                <td>${escapeHTML(attempt.status)}</td>

            </tr>
        `;

    }).join("");

}


/* =====================================================
   STATUS AND BUTTONS
===================================================== */

function renderControls() {

    const team = getSelectedTeam();

    const running = Boolean(currentRun);

    startRunBtn.disabled =
        !team ||
        running ||
        getRemainingAttempts(team) <= 0;

    finishRunBtn.disabled = !running;

    declaredRestartBtn.disabled =
        !team ||
        (running && currentRun.teamId !== team.id) ||
        getRemainingAttempts(team) <= 0;

    switchOperatorBtn.disabled =
        !team ||
        (running && currentRun.teamId !== team.id) ||
        getRemainingAttempts(team) <= 0;

    penaltyButtons.forEach(button => {
        button.disabled = !running;
    });

    if (running) {

        runStatus.textContent = "RUNNING";
        timerHint.textContent = "Robot run in progress";

    } else if (team && getRemainingAttempts(team) <= 0) {

        runStatus.textContent = "ATTEMPTS USED";
        timerHint.textContent = "No attempts remaining";

    } else {

        runStatus.textContent = "WAITING";
        timerHint.textContent = "Ready to begin";

    }

}


/* THEME CONTROL */

function applyTheme() {

    const theme = data.theme || "dark";

    document.body.classList.toggle(
        "light-mode",
        theme === "light"
    );

    if (themeToggle) {
        themeToggle.textContent =
            theme === "light"
                ? "☾ DARK MODE"
                : "☀ LIGHT MODE";
    }

}


themeToggle.addEventListener("click", function () {

    data.theme = data.theme === "dark" ? "light" : "dark";

    applyTheme();

    saveData();
    broadcastDisplay();

});


/* =====================================================
   AUDIENCE DISPLAY DATA
===================================================== */

function createDisplayData() {

    const team = currentRun
        ? data.teams.find(item => item.id === currentRun.teamId)
        : getSelectedTeam();

    const ranked = getRankedTeams();

    return {

        theme: data.theme,

        currentTeam: team ? {
            id: team.id,
            name: team.name,
            player1: team.player1,
            player2: team.player2,
            currentOperator: team.currentOperator
        } : null,

        isRunning: Boolean(currentRun),

        timer: currentRun
            ? getElapsedTime()
            : 0,

        penalty: currentRun
            ? currentRun.penalty
            : 0,

        attempt: currentRun
            ? currentRun.attemptNumber
            : team
                ? getUsedAttempts(team) + 1
                : null,

        runStatus: currentRun
            ? "RUNNING"
            : "WAITING",

        teamCount: data.teams.length,

        leaderboard: ranked.map((item, index) => ({
            id: item.team.id,
            name: item.team.name,
            bestTime: item.best
                ? getAdjustedTime(item.best)
                : null,
            attempts: getUsedAttempts(item.team),
            rank: item.best ? index + 1 : null
        })),
        teamDetails: data.teams.map(team => ({
    id: team.id,
    name: team.name,
    player1: team.player1,
    player2: team.player2,
    attempts: team.attempts.map(attempt => ({
        ...attempt
    }))
})),

        winner: data.competitionWinner,

        updatedAt: new Date().toISOString()

    };

}


function broadcastDisplay() {

    const displayData = createDisplayData();

    localStorage.setItem(
        DISPLAY_KEY,
        JSON.stringify(displayData)
    );

    if (channel) {
        channel.postMessage(displayData);
    }

}


/* CONNECTION STATUS */

function updateConnectionStatus() {

    if (!connectionStatus) return;

    connectionStatus.textContent = channel
        ? "● CONNECTED"
        : "● LOCAL MODE";

}


/* OPEN AUDIENCE DISPLAY */

openDisplayBtn.addEventListener("click", function () {

    window.open(
        "display.html",
        "MiniRoboCupAudience",
        "width=1400,height=900"
    );

});


/* CSV EXPORT */

exportBtn.addEventListener("click", function () {

    if (data.teams.length === 0) {
        alert("There are no team records to export.");
        return;
    }

    const rows = [
        [
            "Team",
            "Player 1",
            "Player 2",
            "Attempt",
            "Operator",
            "Run Time",
            "Penalty",
            "Adjusted Time",
            "Status"
        ]
    ];

    data.teams.forEach(team => {

        team.attempts.forEach(attempt => {

            rows.push([
                team.name,
                team.player1,
                team.player2,
                attempt.number,
                `Player ${attempt.operator}`,
                formatTime(attempt.elapsed),
                formatSeconds(attempt.penalty),
                attempt.status === "Completed"
                    ? formatTime(getAdjustedTime(attempt))
                    : "",
                attempt.status
            ]);

        });

    });

    const csv = rows.map(row =>
        row.map(value =>
            `"${String(value).replace(/"/g, '""')}"`
        ).join(",")
    ).join("\n");

    const blob = new Blob(
        [csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "Mini-RoboCup-Results.csv";

    link.click();

    URL.revokeObjectURL(url);

});


/* RESET ALL DATA */

resetAllBtn.addEventListener("click", function () {

    const confirmed = confirm(
        "RESET THE ENTIRE COMPETITION?\n\n" +
        "All registered teams and recorded attempts will be deleted."
    );

    if (!confirmed) return;

    stopTimer();

    currentRun = null;
    selectedTeamId = null;

    data = createEmptyData();

    saveAndRender();

});


/* HTML ESCAPING */

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => {

        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];

    });

}


/* RENDER ALL */

function renderAll() {

    applyTheme();

    renderTeamSelector();
    renderActiveTeam();

    renderAttemptTracker();
    renderAttemptHistory();

    renderLeaderboard();
    renderControls();

    renderTimer();

    teamCount.textContent =
        `${data.teams.length} TEAM${data.teams.length === 1 ? "" : "S"}`;

    penaltyTotal.textContent = currentRun
        ? formatSeconds(currentRun.penalty)
        : "0.00";

    broadcastDisplay();

}


function saveAndRender() {

    saveData();

    renderAll();

}


/* INITIALIZATION */

function initialize() {

    if (data.teams.length > 0) {
        selectedTeamId = data.teams[0].id;
    }

    updateConnectionStatus();

    checkWinner();

    renderAll();

}

initialize();


/* LIVE TIMER AND DISPLAY SYNCHRONIZATION */

setInterval(() => {

    if (currentRun) {
        renderTimer();
        broadcastDisplay();
    }

}, 100);


/* LISTEN FOR OTHER TAB UPDATES */

if (channel) {

    channel.onmessage = function (event) {

        if (event.data && event.data.type === "request-update") {
            broadcastDisplay();
        }

    };

}
