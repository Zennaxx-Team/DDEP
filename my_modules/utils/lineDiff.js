function normalizeLine(line) {
    return line ?? "";
}

function detectChangeType(left, right) {
    const l = normalizeLine(left);
    const r = normalizeLine(right);

    if (l === r) return "unchanged";
    if (l && !r) return "removed";
    if (!l && r) return "added";
    return "modified";
}

// NEW: Normalize JSON to force same formatting
function normalizeJSON(input) {
    if (typeof input === "string") {
        try {
            return JSON.stringify(JSON.parse(input), null, 2); // 2-space formatting
        } catch {
            // fallback: if invalid JSON, return as-is
            return input;
        }
    }
    return JSON.stringify(input, null, 2);
}

async function lineByLineDiff(leftInput, rightInput) {
    const leftText = normalizeJSON(leftInput);
    const rightText = normalizeJSON(rightInput);

    const leftLines = leftText.split("\n");
    const rightLines = rightText.split("\n");
    const maxLen = Math.max(leftLines.length, rightLines.length);

    const stats = {
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 0,
        total: maxLen
    };

    const rows = [];

    for (let i = 0; i < maxLen; i++) {
        const left = leftLines[i] ?? "";
        const right = rightLines[i] ?? "";

        const changeType = detectChangeType(left, right);
        stats[changeType]++;

        rows.push({
            lineNo: i + 1,
            changeType,
            left,
            right
        });
    }

    return { stats, rows, leftText, rightText };
}

module.exports = { lineByLineDiff };
