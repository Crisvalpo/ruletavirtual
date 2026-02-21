const { autonomousTask } = require("../src/ai/agent");

async function main() {
    const task = process.argv.slice(2).join(" ") || "Create a simple calculator function";

    console.log(`🎯 Target Task: ${task}`);
    try {
        await autonomousTask(task);
    } catch (error) {
        console.error("❌ Agent execution failed:", error.message);
    }
}

main();
