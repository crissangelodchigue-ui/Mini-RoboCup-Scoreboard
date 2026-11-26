
/* =====================================================
   MINI ROBOCUP SCOREBOARD
   AUDIENCE DISPLAY SYSTEM
===================================================== */

const DISPLAY_KEY = "miniRoboCupDisplayData";
const CHANNEL_NAME = "miniRoboCupScoreboard";


/* =====================================================
   ELEMENTS
===================================================== */

const displayTeamName = document.getElementById("displayTeamName");
const displayPlayer1 = document.getElementById("displayPlayer1");
const displayPlayer2 = document.getElementById("displayPlayer2");
const displayOperator = document.getElementById("displayOperator");

const displayTimer = document.getElementById("displayTimer");
const displayRunStatus = document.getElementById("displayRunStatus");
const displayAttempt = document.getElementById("displayAttempt");

const displayPenalty = document.getElementById("displayPenalty");
const displayTeamCount = document.getElementById("displayTeamCount");
const displayLastUpdated = document.getElementById("displayLastUpdated");

const displayLeaderboard = document.getElementById("displayLeaderboard");

const winnerSection = document.getElementById("winnerSection");
const winnerTeamName = document.getElementById("winnerTeamName");
const winnerTime = document.getElementById("winnerTime");


/* =====================================================
   STATE
===================================================== */

let displayData = null;
let channel = null;

try {
    channel = new BroadcastChannel(CHANNEL_NAME);
} catch (error) {
    console.warn("BroadcastChannel is unavailable.", error);
}


/* =====================================================
   HELPERS
===================================================== */

function formatTime(milliseconds) {

    const total = Math.max(0, milliseconds || 0);

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
    return ((milliseconds || 0) / 1000).toFixed(2);
}


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


function getLiveElapsedTime() {

    if (!displayData) return 0;

    let elapsed = displayData.timer || 0;

    if (displayData.isRunning && displayData.updatedAt) {

        const lastUpdate = new Date(displayData.updatedAt).getTime();

        if (Number.isFinite(lastUpdate)) {
            elapsed += Math.max(0, Date.now() - lastUpdate);
        }

    }

    return elapsed;

}


/* =====================================================
   THEME
===================================================== */

function applyTheme() {

    if (!displayData) return;

    document.body.classList.toggle(
        "light-mode",
        displayData.theme === "light"
    );

}


/* =====================================================
   CURRENT MATCH
===================================================== */

function renderCurrentMatch() {

    const team = displayData.currentTeam;

    if (!team) {

        displayTeamName.textContent = "WAITING FOR TEAM";

        displayPlayer1.textContent = "—";
        displayPlayer2.textContent = "—";
        displayOperator.textContent = "—";

        displayAttempt.textContent = "—";

        displayRunStatus.textContent = "WAITING";

        displayTimer.textContent = "00:00.00";

        displayPenalty.textContent = "0.00 SEC";

        return;
    }

    displayTeamName.textContent = team.name || "UNNAMED TEAM";

    displayPlayer1.textContent = team.player1 || "—";
    displayPlayer2.textContent = team.player2 || "—";

    displayOperator.textContent =
        `PLAYER ${team.currentOperator || "—"}`;

    displayAttempt.textContent =
        displayData.attempt ?? "—";

    displayRunStatus.textContent =
        displayData.isRunning ? "RUN IN PROGRESS" : "WAITING";

    displayTimer.textContent =
        formatTime(getLiveElapsedTime());

    displayPenalty.textContent =
        `${formatSeconds(displayData.penalty)} SEC`;

}


/* =====================================================
   LEADERBOARD
===================================================== */

function renderLeaderboard() {

    const teams = displayData.leaderboard || [];

    if (teams.length === 0) {

        displayLeaderboard.innerHTML = `
            <div class="empty-state">
                Waiting for completed runs.
            </div>
        `;

        return;
    }

    const sortedTeams = [...teams].sort((a, b) => {

        if (a.bestTime === null && b.bestTime === null) return 0;
        if (a.bestTime === null) return 1;
        if (b.bestTime === null) return -1;

        return a.bestTime - b.bestTime;

    });

    let previousTime = null;
    let previousRank = 0;

    displayLeaderboard.innerHTML = sortedTeams.map((team, index) => {

        let rank = "—";

        if (team.bestTime !== null) {

            if (team.bestTime !== previousTime) {
                previousRank = index + 1;
            }

            rank = previousRank;
            previousTime = team.bestTime;

        }

        const rankLabel = rank === 1
            ? "🥇"
            : rank === 2
                ? "🥈"
                : rank === 3
                    ? "🥉"
                    : rank;

        return `
            <button
                type="button"
                class="leader-row audience-team-row"
                data-team-id="${escapeHTML(team.id)}"
                title="Click to view team attempts"
            >

                <span class="rank">
                    ${rankLabel}
                </span>

                <span class="leader-team">

                    <strong>
                        ${escapeHTML(team.name)}
                    </strong>

                    <small>
                        ${team.attempts || 0}/3 attempts
                    </small>

                </span>

                <span class="leader-time">
                    ${team.bestTime !== null
                        ? formatTime(team.bestTime)
                        : "NO TIME"}
                </span>

            </button>
        `;

    }).join("");


    displayLeaderboard
        .querySelectorAll(".audience-team-row")
        .forEach(button => {

            button.addEventListener("click", function () {

                showTeamAttempts(button.dataset.teamId);

            });

        });

}


/* =====================================================
   TEAM ATTEMPT DETAILS
===================================================== */

function showTeamAttempts(teamId) {

    const team = (displayData.teamDetails || []).find(
        item => item.id === teamId
    );

    if (!team) {
        alert(
            "Attempt details are not available yet. " +
            "Please update the facilitator script as instructed below."
        );
        return;
    }

    let modal = document.getElementById("teamDetailsModal");

    if (!modal) {

        modal = document.createElement("div");

        modal.id = "teamDetailsModal";

        modal.innerHTML = `
            <div class="team-details-card">

                <button
                    type="button"
                    class="team-details-close"
                    id="closeTeamDetails"
                    aria-label="Close team details"
                >
                    ×
                </button>

                <div class="eyebrow">
                    TEAM PERFORMANCE
                </div>

                <h2 id="detailsTeamName"></h2>

                <div class="team-details-players" id="detailsPlayers"></div>

                <div class="team-details-table-wrap">

                    <table>

                        <thead>
                            <tr>
                                <th>Attempt</th>
                                <th>Operator</th>
                                <th>Run Time</th>
                                <th>Penalty</th>
                                <th>Adjusted Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody id="detailsAttemptRows"></tbody>

                    </table>

                </div>

                <div class="team-details-summary" id="detailsSummary"></div>

            </div>
        `;

        document.body.appendChild(modal);

        const style = document.createElement("style");

        style.textContent = `
            #teamDetailsModal {
                position: fixed;
                inset: 0;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(3, 8, 25, 0.78);
                backdrop-filter: blur(10px);
            }

            .team-details-card {
                position: relative;
                width: min(100%, 1050px);
                max-height: 85vh;
                overflow-y: auto;
                padding: 30px;
                border: 1px solid rgba(57, 231, 255, 0.4);
                border-radius: 20px;
                background: #111e40;
                color: white;
                box-shadow: 0 0 35px rgba(57, 231, 255, 0.14);
                animation: detailsReveal 0.25s ease;
            }

            @keyframes detailsReveal {
                from {
                    opacity: 0;
                    transform: translateY(12px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .team-details-card h2 {
                margin: 10px 0 20px;
                font-size: clamp(25px, 4vw, 38px);
                overflow-wrap: anywhere;
            }

            .team-details-close {
                position: absolute;
                top: 12px;
                right: 18px;
                border: 0;
                background: transparent;
                color: #39e7ff;
                font-size: 34px;
                cursor: pointer;
            }

            .team-details-players {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-bottom: 20px;
                color: #b9c9ef;
            }

            .team-details-table-wrap {
                overflow-x: auto;
            }

            .team-details-card table {
                width: 100%;
                border-collapse: collapse;
                min-width: 650px;
            }

            .team-details-card th,
            .team-details-card td {
                padding: 13px 12px;
                border-bottom: 1px solid rgba(120, 150, 220, 0.2);
                text-align: left;
                font-size: 13px;
            }

            .team-details-card th {
                color: #39e7ff;
                letter-spacing: 0.5px;
            }

            .team-details-summary {
                margin-top: 20px;
                padding: 15px;
                border: 1px solid rgba(57, 231, 255, 0.2);
                border-radius: 12px;
                background: rgba(57, 231, 255, 0.07);
                color: #dce8ff;
                line-height: 1.8;
            }

            body.light-mode .team-details-card {
                background: #ffffff;
                color: #172344;
            }

            body.light-mode .team-details-players,
            body.light-mode .team-details-summary {
                color: #52658f;
            }

            body.light-mode .team-details-summary {
                background: #edf4ff;
            }

            .audience-team-row {
                width: 100%;
                color: inherit;
                font: inherit;
                text-align: left;
                cursor: pointer;
            }

            .audience-team-row:hover {
                transform: translateY(-3px);
                border-color: rgba(57, 231, 255, 0.65);
                box-shadow: 0 0 18px rgba(57, 231, 255, 0.15);
            }
        `;

        document.head.appendChild(style);

        modal.addEventListener("click", function (event) {

            if (
                event.target === modal ||
                event.target.id === "closeTeamDetails"
            ) {
                modal.remove();
            }

        });

    }

    const bestAttempt = (team.attempts || [])
        .filter(attempt => attempt.status === "Completed")
        .sort((a, b) =>
            (a.elapsed + a.penalty) - (b.elapsed + b.penalty)
        )[0];

    document.getElementById("detailsTeamName").textContent =
        team.name;

    document.getElementById("detailsPlayers").innerHTML = `
        <span>PLAYER 1: <strong>${escapeHTML(team.player1)}</strong></span>
        <span>PLAYER 2: <strong>${escapeHTML(team.player2)}</strong></span>
    `;

    const rows = (team.attempts || []).map(attempt => {

        const adjusted = attempt.elapsed + attempt.penalty;

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

    document.getElementById("detailsAttemptRows").innerHTML =
        rows || `
            <tr>
                <td colspan="6">No attempts recorded.</td>
            </tr>
        `;

    document.getElementById("detailsSummary").innerHTML =
        bestAttempt
            ? `
                <strong>BEST VALID TIME:</strong>
                ${formatTime(bestAttempt.elapsed + bestAttempt.penalty)}
                <br>
                <strong>ATTEMPTS USED:</strong>
                ${(team.attempts || []).length} / 3
            `
            : `
                <strong>BEST VALID TIME:</strong>
                No completed attempt
                <br>
                <strong>ATTEMPTS USED:</strong>
                ${(team.attempts || []).length} / 3
            `;

}


/* =====================================================
   WINNER ANNOUNCEMENT
===================================================== */

function renderWinner() {

    const winner = displayData.winner;

    winnerSection.classList.remove("show");

    if (!winner) return;

    if (winner.status === "winner") {

        winnerSection.classList.add("show");

        winnerTeamName.textContent = winner.teamName;

        winnerTime.textContent = formatTime(winner.time);

        return;
    }

    if (winner.status === "tie") {

        winnerSection.classList.add("show");

        winnerTeamName.textContent =
            (winner.teamNames || []).join(" VS ");

        winnerTime.textContent =
            "TIE — TIEBREAKER REQUIRED";

        return;
    }

    if (winner.status === "no-valid-runs") {

        winnerSection.classList.add("show");

        winnerTeamName.textContent = "NO VALID COMPLETED RUNS";

        winnerTime.textContent = "NO WINNER";

    }

}


/* =====================================================
   OTHER MATCH INFORMATION
===================================================== */

function renderOtherInformation() {

    displayTeamCount.textContent =
        displayData.teamCount ?? 0;

    if (displayData.updatedAt) {

        const date = new Date(displayData.updatedAt);

        displayLastUpdated.textContent =
            date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });

    } else {

        displayLastUpdated.textContent = "—";

    }

}


/* =====================================================
   RENDER ALL
===================================================== */

function renderAll() {

    if (!displayData) return;

    applyTheme();

    renderCurrentMatch();

    renderLeaderboard();

    renderWinner();

    renderOtherInformation();

}


/* =====================================================
   RECEIVE DATA
===================================================== */

function receiveData(newData) {

    if (!newData || typeof newData !== "object") return;

    displayData = newData;

    renderAll();

}


/* =====================================================
   LOAD SAVED DATA
===================================================== */

function loadSavedData() {

    try {

        const saved = localStorage.getItem(DISPLAY_KEY);

        if (saved) {
            receiveData(JSON.parse(saved));
        }

    } catch (error) {

        console.error("Could not load display data:", error);

    }

}


/* =====================================================
   CROSS-TAB SYNCHRONIZATION
===================================================== */

window.addEventListener("storage", function (event) {

    if (event.key === DISPLAY_KEY && event.newValue) {

        try {
            receiveData(JSON.parse(event.newValue));
        } catch (error) {
            console.error("Display synchronization error:", error);
        }

    }

});


if (channel) {

    channel.onmessage = function (event) {

        receiveData(event.data);

    };

}


/* =====================================================
   TIMER REFRESH
===================================================== */

setInterval(() => {

    if (displayData && displayData.isRunning) {
        displayTimer.textContent =
            formatTime(getLiveElapsedTime());
    }

}, 50);


/* =====================================================
   INITIALIZATION
===================================================== */

loadSavedData();

if (channel) {

    channel.postMessage({
        type: "request-update"
    });

}
