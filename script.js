/* =========================================================
   GLASS CALCULATOR — LOGIC (vanilla JavaScript)
   Each function is commented to explain its purpose.
   ========================================================= */

/* ---------- DOM references ---------- */
const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const keysEl = document.querySelector(".keys");
const historyListEl = document.getElementById("historyList");
const historyEmptyEl = document.getElementById("historyEmpty");
const clearHistoryBtn = document.getElementById("clearHistory");
const copyBtn = document.getElementById("copyBtn");
const themeToggle = document.getElementById("themeToggle");
const themeLabel = document.getElementById("themeLabel");
const toastEl = document.getElementById("toast");

/* ---------- State ---------- */
// `current` holds the raw expression string the user is building (uses * and / internally).
let current = "";
// `lastResult` stores the most recent computed answer so calculations can continue.
let lastResult = null;
// `history` keeps the last 10 calculations as { expr, result } objects.
let history = [];

/* Operators allowed in an expression. */
const OPERATORS = ["+", "-", "*", "/"];

/* =========================================================
   DISPLAY HELPERS
   ========================================================= */

/**
 * formatForDisplay
 * Converts internal operator symbols (* and /) into the
 * prettier symbols (× and ÷) for the on-screen expression.
 */
function formatForDisplay(str) {
  return str.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/([+\-])/g, " $1 ");
}

/**
 * updateDisplay
 * Renders the current expression and the live/last result
 * to the screen.
 */
function updateDisplay() {
  expressionEl.innerHTML = current ? formatForDisplay(current) : "&nbsp;";

  // Attempt a live preview of the result while typing.
  const preview = safeEvaluate(current);
  if (preview !== null && current !== "") {
    resultEl.textContent = formatNumber(preview);
  } else if (current === "") {
    resultEl.textContent = lastResult !== null ? formatNumber(lastResult) : "0";
  }
}

/**
 * formatNumber
 * Rounds long floating point results and adds thousands
 * separators for readability.
 */
function formatNumber(num) {
  if (!isFinite(num)) return "Error";
  // Round to avoid floating point noise like 0.1 + 0.2 = 0.30000000000000004
  const rounded = Math.round((num + Number.EPSILON) * 1e10) / 1e10;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 10 });
}

/* =========================================================
   EXPRESSION EVALUATION
   ========================================================= */

/**
 * safeEvaluate
 * Safely evaluates a math expression string.
 * Returns a number, or null if the expression is incomplete/invalid.
 * Uses a strict whitelist + Function constructor (no global eval).
 */
function safeEvaluate(expr) {
  if (!expr) return null;

  // Reject anything that isn't digits, operators, dot, or parentheses.
  if (!/^[0-9+\-*/.%() ]+$/.test(expr)) return null;

  // Don't evaluate if it ends on an operator or dot (incomplete).
  if (/[+\-*/.]$/.test(expr.trim())) return null;

  try {
    // Convert percentage "50%" into "(50/100)".
    const normalized = expr.replace(/(\d+(\.\d+)?)%/g, "($1/100)");

    // eslint-disable-next-line no-new-func
    const value = Function('"use strict"; return (' + normalized + ")")();

    if (typeof value !== "number" || isNaN(value) || !isFinite(value)) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/* =========================================================
   INPUT HANDLERS
   ========================================================= */

/**
 * inputValue
 * Appends a number, decimal, operator, or percentage to the
 * current expression while preventing invalid sequences.
 */
function inputValue(value) {
  const lastChar = current.slice(-1);

  // If a result was just shown and the user types a number,
  // start fresh. If they type an operator, continue from result.
  if (lastResult !== null && current === "") {
    if (OPERATORS.includes(value)) {
      current = String(lastResult);
    }
    lastResult = null;
  }

  // --- Operator rules ---
  if (OPERATORS.includes(value)) {
    if (current === "" && value !== "-") return; // can't start with + * /
    if (OPERATORS.includes(lastChar)) {
      // Replace the previous operator instead of stacking two.
      current = current.slice(0, -1) + value;
      updateDisplay();
      return;
    }
  }

  // --- Decimal rules ---
  if (value === ".") {
    // Find the current number segment (after the last operator).
    const segment = current.split(/[+\-*/]/).pop();
    if (segment.includes(".")) return; // only one dot per number
    if (segment === "") value = "0."; // turn ".5" into "0.5"
  }

  // --- Percentage rules ---
  if (value === "%") {
    if (current === "" || OPERATORS.includes(lastChar) || lastChar === "%") return;
  }

  current += value;
  updateDisplay();
}

/**
 * clearAll
 * Resets the calculator to its initial state.
 */
function clearAll() {
  current = "";
  lastResult = null;
  updateDisplay();
}

/**
 * deleteLast
 * Removes the last character from the expression (backspace).
 */
function deleteLast() {
  if (current === "" && lastResult !== null) {
    // Editing a finished result: bring it back as an expression.
    current = String(lastResult);
    lastResult = null;
  }
  current = current.slice(0, -1);
  updateDisplay();
}

/**
 * calculate
 * Evaluates the full expression when "=" or Enter is pressed.
 * Handles errors (e.g. division by zero) gracefully.
 */
function calculate() {
  if (current === "") return;

  const value = safeEvaluate(current);

  if (value === null) {
    // Invalid expression or division by zero (Infinity) ? show Error.
    showError();
    return;
  }

  const formatted = formatNumber(value);
  const prettyExpr = formatForDisplay(current);

  // Save to history and reset for continuous calculation.
  addToHistory(prettyExpr, formatted);

  lastResult = value;
  current = "";
  expressionEl.innerHTML = prettyExpr + " =";
  resultEl.textContent = formatted;

  // Trigger the pop animation on the result.
  flashResult();
}

/**
 * showError
 * Displays "Error" and resets the expression.
 */
function showError() {
  resultEl.textContent = "Error";
  expressionEl.innerHTML = "&nbsp;";
  current = "";
  lastResult = null;
  flashResult();
}

/**
 * flashResult
 * Adds a short CSS animation class to the result element.
 */
function flashResult() {
  resultEl.classList.remove("flash");
  // Force reflow so the animation can restart.
  void resultEl.offsetWidth;
  resultEl.classList.add("flash");
}

/* =========================================================
   HISTORY
   ========================================================= */

/**
 * addToHistory
 * Stores a calculation and keeps only the last 10 entries.
 */
function addToHistory(expr, result) {
  history.unshift({ expr, result });
  if (history.length > 10) history.pop();
  renderHistory();
}

/**
 * renderHistory
 * Rebuilds the history list in the DOM. Clicking an item
 * reuses its result as the new starting value.
 */
function renderHistory() {
  // Toggle the "empty" placeholder.
  historyEmptyEl.style.display = history.length ? "none" : "block";

  // Remove existing items (but keep the empty placeholder element).
  historyListEl.querySelectorAll(".history__item").forEach((el) => el.remove());

  history.forEach((item) => {
    const li = document.createElement("li");
    li.className = "history__item";
    li.innerHTML =
      '<span class="history__item-expr">' +
      item.expr +
      ' =</span><span class="history__item-result">' +
      item.result +
      "</span>";

    // Clicking a history entry loads its result for further use.
    li.addEventListener("click", () => {
      current = item.result.replace(/,/g, ""); // strip thousands separators
      lastResult = null;
      updateDisplay();
    });

    historyListEl.appendChild(li);
  });
}

/**
 * clearHistory
 * Empties the history panel.
 */
function clearHistory() {
  history = [];
  renderHistory();
}

/* =========================================================
   COPY RESULT
   ========================================================= */

/**
 * copyResult
 * Copies the currently displayed result to the clipboard.
 */
async function copyResult() {
  const text = resultEl.textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied: " + text);
  } catch {
    // Fallback for browsers without clipboard API.
    showToast("Copy failed");
  }
}

/**
 * showToast
 * Briefly shows a feedback message at the bottom of the screen.
 */
let toastTimer;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

/* =========================================================
   THEME TOGGLE
   ========================================================= */

/**
 * toggleTheme
 * Switches between the dark and light themes.
 */
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  themeLabel.textContent = next === "dark" ? "Dark" : "Light";
  // Update the browser theme-color meta for mobile.
  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute("content", next === "dark" ? "#0f172a" : "#e0e7ff");
}

/* =========================================================
   EVENT WIRING
   ========================================================= */

/**
 * handleKeyClick
 * Delegated click handler for all calculator buttons.
 * Reads data-value or data-action attributes.
 */
function handleKeyClick(event) {
  const btn = event.target.closest(".key");
  if (!btn) return;

  const action = btn.dataset.action;
  const value = btn.dataset.value;

  if (action === "clear") clearAll();
  else if (action === "delete") deleteLast();
  else if (action === "equals") calculate();
  else if (value !== undefined) inputValue(value);
}

// Attach button listeners.
keysEl.addEventListener("click", handleKeyClick);
clearHistoryBtn.addEventListener("click", clearHistory);
copyBtn.addEventListener("click", copyResult);
themeToggle.addEventListener("click", toggleTheme);

/**
 * handleKeyboard
 * Maps physical keyboard keys to calculator actions.
 */
function handleKeyboard(event) {
  const key = event.key;

  if (/[0-9]/.test(key)) inputValue(key);
  else if (key === ".") inputValue(".");
  else if (key === "+" || key === "-" || key === "*" || key === "/") inputValue(key);
  else if (key === "%") inputValue("%");
  else if (key === "Enter" || key === "=") {
    event.preventDefault(); // stop form-like submit behavior
    calculate();
  } else if (key === "Backspace") deleteLast();
  else if (key === "Escape") clearAll();
}

document.addEventListener("keydown", handleKeyboard);

/* ---------- Initial render ---------- */
updateDisplay();
renderHistory();
