const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { askOllama } = require("./ollamaClient");

/**
 * Strips markdown backticks and extracts code
 */
function cleanCode(text) {
    // Regex to match ```javascript ... ``` or ``` ... ```
    const regex = /```(?:javascript|js)?\n([\s\S]*?)```/i;
    const match = text.match(regex);
    if (match) {
        return match[1].trim();
    }
    // If no backticks, just trim the whole thing
    return text.trim();
}

/**
 * Runs the generated file and captures output/errors
 */
function runGeneratedFile(filePath) {
    return new Promise((resolve) => {
        exec(`node ${filePath}`, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: stderr || error.message });
            } else {
                resolve({ success: true, output: stdout });
            }
        });
    });
}

/**
 * Commits changes to git
 */
function gitCommit(message) {
    return new Promise((resolve) => {
        exec(`git add . && git commit -m "${message}"`, (error, stdout, stderr) => {
            if (error) {
                console.error("⚠️ Git commit failed:", stderr);
                resolve(false);
            } else {
                console.log("📦 Git commit successful");
                resolve(true);
            }
        });
    });
}

async function autonomousTask(taskDescription) {
    console.log("🧠 Planning...");

    const plan = await askOllama(`
You are a senior software engineer.
Create a step-by-step implementation plan for this task:

${taskDescription}
`);

    console.log("📋 Plan:\n", plan);

    console.log("💻 Generating code...");

    let code = await askOllama(`
You are a senior Node.js engineer.
Generate production-ready code.

Rules:
- Return ONLY valid JavaScript.
- No explanations.
- No markdown.
- No comments outside code.
- The code must run without modification.

Task:
${taskDescription}
`);

    const filePath = path.join(__dirname, "../generatedTask.js");
    fs.writeFileSync(filePath, cleanCode(code));
    console.log("💾 Initial code saved at:", filePath);

    let attempts = 0;
    let success = false;

    while (attempts < 3) {
        console.log(`🚀 Execution attempt ${attempts + 1}...`);
        const result = await runGeneratedFile(filePath);

        if (result.success) {
            console.log("✅ Code executed successfully");
            console.log("📄 Output:\n", result.output);
            success = true;
            break;
        }

        console.log("⚠️ Error detected:\n", result.error);
        console.log("🔧 Fixing...");

        code = await askOllama(`
The following code has an error:

ERROR:
${result.error}

Original Task:
${taskDescription}

Current Code:
${code}

Fix it completely. 
Rules:
- Return ONLY corrected JavaScript.
- No explanations.
- No markdown.
- No comments outside code.
`);

        fs.writeFileSync(filePath, cleanCode(code));
        attempts++;
    }

    if (success) {
        console.log("🏁 Task completed successfully!");
        await gitCommit(`ai-agent: ${taskDescription.substring(0, 50)}`);
    } else {
        console.log("❌ Failed to complete task after 3 attempts.");
    }
}

module.exports = { autonomousTask };
