const textInput = document.getElementById("textInput");
const scanPageButton = document.getElementById("scanPage");
const detectTextButton = document.getElementById("detectText");

const tabs = [...document.querySelectorAll(".tab")];

const textPanel = document.getElementById("textPanel");
const imagePanel = document.getElementById("imagePanel");

const textScoreEl = document.getElementById("textScore");
const textSummaryEl = document.getElementById("textSummary");
const signalsEl = document.getElementById("signals");

const textProgress = document.querySelector("#textMeter .progress-bar");

const imageInput = document.getElementById("imageInput");
const imageCanvas = document.getElementById("imageCanvas");

const imageScoreEl = document.getElementById("imageScore");
const imageSummaryEl = document.getElementById("imageSummary");

const imageProgress = document.querySelector("#imageMeter .progress-bar");

let mode = "text";

tabs.forEach(tab => {

    tab.addEventListener("click", () => {

        mode = tab.dataset.mode;

        tabs.forEach(item => {

            item.classList.remove("active");

        });

        tab.classList.add("active");

        textPanel.hidden = mode !== "text";

        imagePanel.hidden = mode !== "image";

    });

});

textInput.addEventListener("input", renderTextAnalysis);

detectTextButton.addEventListener("click", renderTextAnalysis);

scanPageButton.addEventListener("click", scanCurrentPage);

imageInput.addEventListener("change", analyzeUploadedImage);

renderTextAnalysis();

async function scanCurrentPage(){

    if(mode !== "text"){

        tabs.find(tab => tab.dataset.mode === "text").click();

    }

    scanPageButton.disabled = true;

    scanPageButton.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2"></span>
        Scanning
    `;

    try{

        const [tab] = await chrome.tabs.query({

            active:true,
            currentWindow:true

        });

        if(!tab?.id){

            resetScanButton();

            return;

        }

        const response = await chrome.tabs.sendMessage(tab.id,{

            type:"GET_PAGE_TEXT"

        });

        const text = response?.selection || response?.pageText || "";

        if(text){

            textInput.value = text;

            renderTextAnalysis();

        }

        else{

            textSummaryEl.textContent =
            "No readable text found on this page.";

        }

    }

    catch(error){

        textSummaryEl.textContent =
        "Unable to scan this page. Paste text manually.";

    }

    finally{

        resetScanButton();

    }

}

function resetScanButton(){

    scanPageButton.disabled = false;

    scanPageButton.innerHTML = `
        <i class="bi bi-search"></i>
        Scan
    `;

}

function renderTextAnalysis(){

    const analysis = analyzeText(textInput.value);

    if(analysis.ready){

        textScoreEl.textContent = `${analysis.score}%`;

        textProgress.style.width = `${analysis.score}%`;

        textProgress.setAttribute(
            "aria-valuenow",
            analysis.score
        );

    }

    else{

        textScoreEl.textContent = "Need More";

        textProgress.style.width = "0%";

    }

    textSummaryEl.textContent = analysis.summary;

    signalsEl.innerHTML = "";

    analysis.signals.forEach(signal=>{

        const item=document.createElement("li");

        item.className="list-group-item";

        item.innerHTML=`<i class="bi bi-check-circle-fill me-2 text-success"></i>${signal}`;

        signalsEl.appendChild(item);

    });

}
function analyzeText(rawText){

    const text = rawText.replace(/\s+/g," ").trim();

    const sentences = splitSentences(text);

    const words = text
        .toLowerCase()
        .match(/[a-z0-9]+(?:'[a-z]+)?/g) || [];

    const uniqueWords = new Set(words);

    const wordCount = words.length;

    if(wordCount < 80){

        return{

            ready:false,

            score:0,

            summary:"Paste at least 80 words for reliable analysis.",

            signals:[
                `${wordCount} words detected`,
                "Short text can produce unreliable predictions.",
                "Analysis is based on local writing patterns."
            ]

        };

    }

    const lengths = sentences
        .map(sentence =>
            (sentence.match(/[a-z0-9]+(?:'[a-z]+)?/gi)||[]).length
        )
        .filter(Boolean);

    const avgSentenceLength = average(lengths);

    const variation = coefficientOfVariation(lengths);

    const diversity = uniqueWords.size / wordCount;

    const transitionRate =
        countMatches(text,textTransitions()) /
        Math.max(1,sentences.length);

    const hedgeRate =
        countMatches(text,hedgeWords()) /
        Math.max(1,wordCount) * 100;

    const repeatedPhraseRate =
        repeatedPhraseRatio(words);

    let score = 18;

    const signals = [];

    if(variation < .42){

        score += 18;

        signals.push("Very consistent sentence rhythm detected.");

    }

    else{

        score -= 5;

        signals.push("Sentence rhythm appears natural.");

    }

    if(diversity < .46){

        score += 15;

        signals.push("Vocabulary repetition is relatively high.");

    }

    else{

        score -= 4;

        signals.push("Vocabulary diversity looks natural.");

    }

    if(transitionRate > .28){

        score += 15;

        signals.push("Frequent polished transition phrases detected.");

    }

    else{

        signals.push("Transition usage looks balanced.");

    }

    if(hedgeRate > 1.2){

        score += 12;

        signals.push("Cautious wording appears frequently.");

    }

    else{

        signals.push("Limited use of hedge words.");

    }

    if(avgSentenceLength >=16 && avgSentenceLength <=28){

        score += 8;

        signals.push("Average sentence length matches common AI output.");

    }

    else{

        score -=3;

        signals.push("Sentence length varies from typical AI writing.");

    }

    if(repeatedPhraseRate > .026){

        score +=12;

        signals.push("Repeated phrase patterns detected.");

    }

    const finalScore = clamp(
        Math.round(score),
        1,
        99
    );

    return{

        ready:true,

        score:finalScore,

        summary:describeTextScore(
            finalScore,
            wordCount
        ),

        signals

    };

}

async function analyzeUploadedImage(){

    const file = imageInput.files?.[0];

    if(!file){

        imageScoreEl.textContent="0%";

        imageProgress.style.width="0%";

        imageSummaryEl.textContent=
        "Upload an image to begin analysis.";

        return;

    }

    const bitmap =
        await createImageBitmap(file);

    const ctx =
        imageCanvas.getContext(
            "2d",
            {willReadFrequently:true}
        );

    const size = 192;

    imageCanvas.width=size;

    imageCanvas.height=size;

    ctx.clearRect(
        0,
        0,
        size,
        size
    );

    ctx.drawImage(
        bitmap,
        0,
        0,
        size,
        size
    );

    const imageData =
        ctx.getImageData(
            0,
            0,
            size,
            size
        ).data;

    const score =
        detectAiImagePercentage(
            imageData,
            size,
            size
        );

    imageScoreEl.textContent=`${score}%`;

    imageProgress.style.width=`${score}%`;

    imageProgress.setAttribute(
        "aria-valuenow",
        score
    );

    imageSummaryEl.textContent=
        describeImageScore(score);

}
function detectAiImagePercentage(data, width, height){

    let smoothPixels = 0;
    let edgePixels = 0;
    let saturatedPixels = 0;
    let total = 0;
    let symmetryDiff = 0;

    for(let y = 1; y < height - 1; y++){

        for(let x = 1; x < width - 1; x++){

            const index = (y * width + x) * 4;
            const right = (y * width + x + 1) * 4;
            const down = ((y + 1) * width + x) * 4;
            const mirror = (y * width + (width - 1 - x)) * 4;

            const brightness = luminance(
                data[index],
                data[index + 1],
                data[index + 2]
            );

            const rightBrightness = luminance(
                data[right],
                data[right + 1],
                data[right + 2]
            );

            const downBrightness = luminance(
                data[down],
                data[down + 1],
                data[down + 2]
            );

            const mirrorBrightness = luminance(
                data[mirror],
                data[mirror + 1],
                data[mirror + 2]
            );

            const gradient =
                Math.abs(brightness - rightBrightness) +
                Math.abs(brightness - downBrightness);

            const saturation = colorSaturation(
                data[index],
                data[index + 1],
                data[index + 2]
            );

            if(gradient < 11) smoothPixels++;

            if(gradient > 52) edgePixels++;

            if(saturation > .62) saturatedPixels++;

            symmetryDiff += Math.abs(
                brightness - mirrorBrightness
            );

            total++;

        }

    }

    const smoothness = smoothPixels / total;

    const edgeRate = edgePixels / total;

    const saturationRate = saturatedPixels / total;

    const symmetry =
        1 - Math.min(1, symmetryDiff / total / 85);

    const smoothScore =
        scaleRange(smoothness, .36, .72, 8, 38);

    const edgeScore =
        scaleRange(.28 - edgeRate, 0, .28, 0, 22);

    const saturationScore =
        scaleRange(saturationRate, .08, .34, 0, 18);

    const symmetryScore =
        scaleRange(symmetry, .50, .82, 0, 22);

    return clamp(
        Math.round(
            smoothScore +
            edgeScore +
            saturationScore +
            symmetryScore
        ),
        1,
        99
    );

}

function luminance(r, g, b){

    return 0.2126 * r +
           0.7152 * g +
           0.0722 * b;

}

function colorSaturation(r, g, b){

    const max = Math.max(r, g, b) / 255;

    const min = Math.min(r, g, b) / 255;

    if(max === 0) return 0;

    return (max - min) / max;

}

function splitSentences(text){

    return text
        .split(/(?<=[.!?])\s+/)
        .map(sentence => sentence.trim())
        .filter(Boolean);

}

function countMatches(text, pattern){

    return (text.match(pattern) || []).length;

}

function average(numbers){

    if(!numbers.length) return 0;

    return numbers.reduce(
        (sum, value) => sum + value,
        0
    ) / numbers.length;

}

function coefficientOfVariation(numbers){

    const avg = average(numbers);

    if(!avg) return 0;

    const variance = average(

        numbers.map(

            value => Math.pow(value - avg, 2)

        )

    );

    return Math.sqrt(variance) / avg;

}

function repeatedPhraseRatio(words){

    if(words.length < 12) return 0;

    const phrases = new Map();

    for(let i = 0; i <= words.length - 3; i++){

        const phrase =
            words.slice(i, i + 3).join(" ");

        phrases.set(
            phrase,
            (phrases.get(phrase) || 0) + 1
        );

    }

    let repeats = 0;

    phrases.forEach(count =>{

        if(count > 1){

            repeats += count - 1;

        }

    });

    return repeats / words.length;

}

function textTransitions(){

    return /\b(additionally|as a result|furthermore|however|in conclusion|in summary|moreover|overall|therefore|ultimately|it is worth noting)\b/gi;

}

function hedgeWords(){

    return /\b(can|could|may|might|often|typically|generally|potentially|various|numerous|robust|enhance|streamline)\b/gi;

}

function scaleRange(value, inMin, inMax, outMin, outMax){

    const ratio = clamp(

        (value - inMin) / (inMax - inMin),

        0,

        1

    );

    return outMin + ratio * (outMax - outMin);

}

function describeTextScore(score, words){

    if(score >= 70){

        return `High AI possibility based on ${words} words.`;

    }

    if(score >= 40){

        return `Mixed writing patterns detected across ${words} words.`;

    }

    return `Low AI possibility based on ${words} words.`;

}

function describeImageScore(score){

    if(score >= 70){

        return "High AI image possibility.";

    }

    if(score >= 40){

        return "Mixed AI image signals detected.";

    }

    return "Low AI image possibility.";

}

function clamp(value, min, max){

    return Math.min(

        max,

        Math.max(min, value)

    );

}