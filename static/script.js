document.addEventListener("DOMContentLoaded", () => {
    const dropArea = document.getElementById("drop-area");
    const fileInput = document.getElementById("file-input");
    const previewContainer = document.getElementById("preview-container");
    const resultsContainer = document.getElementById("results-container");
    const imagePreview = document.getElementById("image-preview");
    const analyzeBtn = document.getElementById("analyze-btn");
    const resetBtn = document.getElementById("reset-btn");
    
    let currentFile = null;

    // --- Drag & Drop UI ---
    dropArea.addEventListener("click", () => fileInput.click());

    dropArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropArea.classList.add("drag-active");
    });

    dropArea.addEventListener("dragleave", () => {
        dropArea.classList.remove("drag-active");
    });

    dropArea.addEventListener("drop", (e) => {
        e.preventDefault();
        dropArea.classList.remove("drag-active");
        handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener("change", (e) => {
        handleFile(e.target.files[0]);
    });

    // --- File Handling ---
    function handleFile(file) {
        if (!file) return;
        
        // Basic validation
        const validTypes = ['image/jpeg', 'image/png', 'image/bmp', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            alert("Please upload a valid image file (JPG, PNG, BMP).");
            return;
        }

        currentFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            dropArea.classList.add("hidden");
            previewContainer.classList.remove("hidden");
            resultsContainer.classList.add("hidden");
        };
        reader.readAsDataURL(file);
    }

    // --- Analysis Logic ---
    analyzeBtn.addEventListener("click", async () => {
        if (!currentFile) return;

        // 1. UI Loading State (Scanning Animation)
        previewContainer.classList.add("scanning");
        analyzeBtn.innerHTML = `SCANNING... <i class="fa-solid fa-spinner fa-spin"></i>`;
        analyzeBtn.disabled = true;

        const formData = new FormData();
        formData.append("image", currentFile);

        try {
            // 2. Fetch API Request
            const response = await fetch("/predict", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            // 3. Stop Animation
            previewContainer.classList.remove("scanning");
            analyzeBtn.innerHTML = `INITIALIZE ANALYSIS <i class="fa-solid fa-bolt"></i>`;
            analyzeBtn.disabled = false;

            if (data.error) {
                alert("Error: " + data.error);
                return;
            }

            // 4. Render Results
            renderResults(data);

        } catch (error) {
            console.error(error);
            alert("Server connection failed.");
            previewContainer.classList.remove("scanning");
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = `INITIALIZE ANALYSIS <i class="fa-solid fa-bolt"></i>`;
        }
    });

    function renderResults(data) {
        previewContainer.classList.add("hidden");
        resultsContainer.classList.remove("hidden");

        // Update Main Prediction
        document.getElementById("prediction-text").textContent = data.prediction.toUpperCase();
        
        // Color coding based on result
        const predText = document.getElementById("prediction-text");
        if(data.prediction === "Malignant") {
            predText.style.background = "-webkit-linear-gradient(#ff0055, #ff4444)";
            predText.style.webkitBackgroundClip = "text";
        } else if (data.prediction === "Benign") {
            predText.style.background = "-webkit-linear-gradient(#00f2ff, #0077ff)";
            predText.style.webkitBackgroundClip = "text";
        } else {
            predText.style.background = "-webkit-linear-gradient(#00ff88, #00cc66)";
            predText.style.webkitBackgroundClip = "text";
        }

        // Update Confidence
        document.getElementById("main-confidence").textContent = (data.confidence * 100).toFixed(1) + "%";

        // Generate Probability Bars
        const grid = document.getElementById("probabilities-grid");
        grid.innerHTML = ""; // Clear previous

        // Sort probabilities for better visual
        const sortedProbs = Object.entries(data.probabilities).sort((a, b) => b[1] - a[1]);

        sortedProbs.forEach(([label, score]) => {
            const percentage = (score * 100).toFixed(1);
            let color = "#ffffff";
            
            if(label === "Malignant") color = "#ff4444";
            if(label === "Benign") color = "#00f2ff";
            if(label === "Normal") color = "#00ff88";

            const html = `
                <div class="stat-item">
                    <span class="stat-label">${label}</span>
                    <div class="bar-bg">
                        <div class="bar-fill" style="width: 0%; background-color: ${color}"></div>
                    </div>
                    <span class="stat-value">${percentage}%</span>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', html);

            // Trigger animation after small delay
            setTimeout(() => {
                grid.lastElementChild.querySelector(".bar-fill").style.width = percentage + "%";
            }, 100);
        });
    }

    // --- Reset ---
    resetBtn.addEventListener("click", () => {
        resultsContainer.classList.add("hidden");
        dropArea.classList.remove("hidden");
        currentFile = null;
        fileInput.value = "";
    });
});