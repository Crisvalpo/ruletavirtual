// Native fetch is available in Node 18+

async function askOllama(prompt) {
    const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "qwen2.5-coder:7b",
            prompt,
            stream: false,
            options: {
                temperature: 0.2,
                num_predict: 800
            }
        })
    });

    const data = await response.json();
    return data.response;
}

module.exports = { askOllama };
