/**
 * NEXUS AI - Vehicle Analytics Demo
 * Logic Controller V3.5 (Driver Intelligence Update)
 */

const UPDATE_INTERVAL_MS = 100;
const MEDIUM_INTERVAL_MS = 1000;
const AI_INTERVAL_MS = 2000;
const HISTORY_SIZE = 100;

class MockOBDSimulator {
    constructor() {
        this.state = { rpm: 1000, speed: 0, throttle: 0, load: 20, coolant: 90, battery: 13.8, fuelEff: 8.5 }; // fuelEff L/100km
        this.history = {
            rpm: new Array(HISTORY_SIZE).fill(1000),
            speed: new Array(HISTORY_SIZE).fill(0),
            load: new Array(HISTORY_SIZE).fill(20),
            coolant: new Array(HISTORY_SIZE).fill(90),
            throttle: new Array(HISTORY_SIZE).fill(0),
            fuelEff: new Array(HISTORY_SIZE).fill(8.5)
        };
        this.target = { ...this.state };
        this.isAccelerating = false;
        this.accelCounter = 0;
    }
    tick() {
        this.accelCounter++;
        if (this.accelCounter > 50 && Math.random() > 0.95) {
            this.isAccelerating = !this.isAccelerating;
            this.accelCounter = 0;
        }
        if (this.isAccelerating) {
            this.target.throttle = Math.min(this.target.throttle + 2, 85);
            this.target.rpm = Math.min(this.target.rpm + 60, 5500);
            this.target.speed = Math.min(this.target.speed + 0.8, 140);
            this.target.load = Math.min(this.target.load + 1.5, 95);
            this.target.fuelEff = Math.min(this.target.fuelEff + 0.5, 25); // High consumption
        } else {
            this.target.throttle = Math.max(this.target.throttle - 3, 0);
            this.target.rpm = Math.max(this.target.rpm - 80, 800);
            this.target.speed = Math.max(this.target.speed - 0.4, 0);
            this.target.load = Math.max(this.target.load - 2, 15);
            this.target.fuelEff = Math.max(this.target.fuelEff - 0.2, 4.5); // Low consumption
        }
        this.target.rpm += (Math.random() - 0.5) * 30;
        if (this.state.load > 70) this.target.coolant += 0.02;
        else this.target.coolant = Math.max(this.target.coolant - 0.01, 88);
        this.state.rpm = this.lerp(this.state.rpm, this.target.rpm, 0.08);
        this.state.speed = this.lerp(this.state.speed, this.target.speed, 0.04);
        this.state.throttle = this.lerp(this.state.throttle, this.target.throttle, 0.1);
        this.state.load = this.lerp(this.state.load, this.target.load, 0.08);
        this.state.coolant = this.lerp(this.state.coolant, this.target.coolant, 0.05);
        this.state.fuelEff = this.lerp(this.state.fuelEff, this.target.fuelEff, 0.05);
        this.state.battery = 13.5 + Math.sin(Date.now() / 1000) * 0.2;
        this.updateHistory();
    }
    updateHistory() {
        this.history.rpm.push(this.state.rpm); this.history.rpm.shift();
        this.history.speed.push(this.state.speed); this.history.speed.shift();
        this.history.load.push(this.state.load); this.history.load.shift();
        this.history.coolant.push(this.state.coolant); this.history.coolant.shift();
        this.history.throttle.push(this.state.throttle); this.history.throttle.shift();
        this.history.fuelEff.push(this.state.fuelEff); this.history.fuelEff.shift();
    }
    lerp(start, end, amt) { return (1 - amt) * start + amt * end; }
    getData() { return { ...this.state }; }
    getHistory() { return this.history; }
}

class MLInferenceEngine {
    constructor(simulator) {
        this.sim = simulator;
        this.rulKms = 15000;
    }
    runInference() {
        const data = this.sim.getData();
        const history = this.sim.getHistory();

        // 1. Health
        let thermalHealth = 100;
        if (data.coolant > 100) thermalHealth -= (data.coolant - 100) * 5;
        let engineHealth = 100;
        if (data.rpm > 4500) engineHealth -= 5;
        if (data.load > 90) engineHealth -= 2;
        let elecHealth = 100;
        if (data.battery < 12.8) elecHealth -= 10;
        const hygieneScore = Math.round((thermalHealth * 0.4) + (engineHealth * 0.4) + (elecHealth * 0.2));

        // 2. Anomaly
        const recentRpm = history.rpm.slice(-20);
        const rpmVariance = this.calculateVariance(recentRpm);
        const isAnomaly = rpmVariance > 5000;

        // 3. RUL
        const degradationFactor = (data.load / 100) * 2;
        this.rulKms -= degradationFactor * 0.1;

        // 4. Advanced Driver Logic
        const throttleAggression = this.calculateAggression(history.throttle); // 0-100
        const rpmVol = Math.sqrt(rpmVariance) / 100; // Normalized volatility

        let driverClass = "NORMAL";
        let confidence = 85 + Math.random() * 10;
        let insight = "Behavior within normal baseline.";

        if (throttleAggression > 60) {
            driverClass = "AGGRESSIVE";
            confidence = 92;
            insight = "High throttle aggression detected. Impact on fuel +12%.";
        } else if (throttleAggression < 20 && data.speed > 30) {
            driverClass = "ECO - OPTIMAL";
            confidence = 96;
            insight = "Smooth acceleration profile. Fuel efficiency maximized.";
        } else if (rpmVol > 8) {
            driverClass = "ERRATIC";
            confidence = 78;
            insight = "Unstable RPM detected. Check transmission linkage.";
        }

        return {
            scores: { hygiene: hygieneScore, thermal: thermalHealth, engine: engineHealth, electrical: elecHealth },
            rul: { val: Math.floor(this.rulKms), prob: data.coolant > 102 ? "High" : "Low" },
            anomaly: isAnomaly,
            driver: {
                type: driverClass,
                conf: Math.round(confidence),
                feat: {
                    throttle: Math.round(throttleAggression),
                    rpmVol: rpmVol.toFixed(1),
                    eff: Math.round(100 - (throttleAggression * 0.6))
                },
                insight: insight
            }
        };
    }
    calculateVariance(arr) {
        const mean = arr.reduce((a, b) => a + b) / arr.length;
        return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    }
    calculateAggression(arr) {
        // Simple mock algorithm: sum of positive deltas
        let sumDelta = 0;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] > arr[i - 1]) sumDelta += (arr[i] - arr[i - 1]);
        }
        // Normalize over last 100 ticks (approx 10s)
        return Math.min(100, sumDelta * 2);
    }
}

class DetailedChart {
    constructor(canvasId, color, label, unit) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.color = color;
        this.label = label || '';
        this.unit = unit || '';
        this.data = new Array(60).fill(0);
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.padding = { top: 30, right: 20, bottom: 30, left: 40 };
    }
    update(newValue) {
        if (!this.ctx) return;
        this.data.push(newValue);
        this.data.shift();
        this.draw();
    }
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Background Grid
        const plotW = this.width - this.padding.left - this.padding.right;
        const plotH = this.height - this.padding.top - this.padding.bottom;

        this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        // Verticals
        for (let i = 0; i <= 5; i++) {
            const x = this.padding.left + (plotW / 5) * i;
            this.ctx.moveTo(x, this.padding.top);
            this.ctx.lineTo(x, this.height - this.padding.bottom);
        }
        // Horizontals
        for (let i = 0; i <= 4; i++) {
            const y = this.padding.top + (plotH / 4) * i;
            this.ctx.moveTo(this.padding.left, y);
            this.ctx.lineTo(this.width - this.padding.right, y);
        }
        this.ctx.stroke();

        // Axis Labels
        this.ctx.fillStyle = '#666';
        this.ctx.font = '10px Roboto';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';

        // Y Axis
        const maxVal = Math.max(...this.data, 10);
        const minVal = 0;
        for (let i = 0; i <= 4; i++) {
            const val = minVal + (maxVal - minVal) * (1 - i / 4);
            const y = this.padding.top + (plotH / 4) * i;
            this.ctx.fillText(Math.round(val), this.padding.left - 8, y);
        }

        // X Axis (Time)
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        const times = ['-60s', '-45s', '-30s', '-15s', '-0s'];
        for (let i = 0; i < times.length; i++) {
            const x = this.padding.left + (plotW / 4) * i; // 4 segments for 5 ticks? close enough for mock
            // Actually let's use 5 points: 0, 1, 2, 3, 4
            const xPos = this.padding.left + (plotW / 4) * i;
            this.ctx.fillText(times[i], xPos, this.height - this.padding.bottom + 8);
        }

        // Line Plot
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = 2;
        this.ctx.lineJoin = 'round';

        const step = plotW / (this.data.length - 1);
        for (let i = 0; i < this.data.length; i++) {
            const x = this.padding.left + i * step;
            const normalized = (this.data[i] - minVal) / (maxVal - minVal);
            const y = this.padding.top + plotH - (normalized * plotH);
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();

        // Current Value Tag
        const current = this.data[this.data.length - 1];
        this.ctx.fillStyle = this.color;
        this.ctx.font = 'bold 12px Roboto';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${current.toFixed(1)} ${this.unit}`, this.padding.left + 10, this.padding.top - 10);
    }
}

// Keep CanvasPlotter for Anomaly graph if needed, or replace it entirely? 
// The anomaly graph is small, better keep detailed there too or simple. 
// I'll reuse DetailedChart for Anomaly too for consistency, or keep it simple.
// The user asked for "similar style" for the two main charts.
// Let's replace the old CanvasPlotter with DetailedChart logic but keep the name if other things use it, 
// OR just update the UIController to use DetailedChart.

class UIController {
    constructor(sim, ml) {
        this.sim = sim;
        this.ml = ml;

        // Helper to safely get element
        const get = (id) => document.getElementById(id);

        this.els = {
            rpm: get('val-rpm'),
            speed: get('val-speed'),
            throttle: get('val-throttle'),
            throttleBar: get('prog-throttle'),
            load: get('val-load'),
            loadBar: get('prog-load'),
            coolant: get('val-coolant'),
            battery: get('val-battery'),
            gaugeRpm: get('gauge-rpm-val'),
            gaugeSpeed: get('gauge-speed-val'),
            gaugeTemp: get('gauge-temp-val'),

            // AI ELEMENTS
            healthScore: get('health-score-val'),
            healthRing: get('health-ring-fill'),
            healthRul: get('rul-val'),
            healthRisk: get('health-risk'),
            healthSummary: get('health-summary'),

            driverBadge: get('driver-badge'),
            driverConfBar: get('driver-conf-bar'),
            driverConfVal: get('driver-conf-val'),
            fuelImpact: get('fuel-impact'),
            driverSummary: get('driver-summary'),

            anomalyStatus: get('anomaly-status-badge'),
            anomalyList: get('anomaly-list'),
            recsList: get('recs-list')
        };

        // CHARTS (CanvasPlotter/DetailedChart already handles missing canvas safely)
        this.charts = {
            load: new DetailedChart('load-chart', '#00e5ff', 'ENGINE LOAD', '%'),
            fuel: new DetailedChart('fuel-chart', '#00ff41', 'FUEL ECONOMY', 'L/100km'),
            anomaly: new DetailedChart('anomaly-chart', '#bd00ff', 'RPM DEVIATION', 'Δ')
        };
    }

    updateFast() {
        const data = this.sim.getData();
        if (this.els.rpm) this.els.rpm.textContent = Math.round(data.rpm);
        if (this.els.speed) this.els.speed.textContent = Math.round(data.speed);
        if (this.els.throttle) this.els.throttle.textContent = Math.round(data.throttle);
        if (this.els.load) this.els.load.textContent = Math.round(data.load);
        if (this.els.throttleBar) this.els.throttleBar.style.width = `${data.throttle}%`;
        if (this.els.loadBar) this.els.loadBar.style.width = `${data.load}%`;

        this.updateGauges(data);

        // Charts will self-check for canvas existence
        this.charts.load.update(data.load);
        this.charts.fuel.update(data.fuelEff);
    }

    updateGauges(data) {
        // Speed Gauge (Full Circle)
        if (this.els.gaugeSpeed) this.els.gaugeSpeed.textContent = Math.round(data.speed);

        const maxSpeed = 160;
        // 565 is circumference of r=90 circle
        const speedOffset = 565 - ((data.speed / maxSpeed) * 565 * 0.75); // 0.75 because it's probably not a full 360 use visually? wrapper says full-circle but offset logic suggests partial. 
        // Actually earlier code used 0.75 factor, keeping it for safety or visual preference.
        // Wait, earlier code: const offset = 565 - ((data.speed / maxSpeed) * 565 * 0.75);
        // If it used 0.75, it means at max speed it's 25% empty.

        const gaugeFill = document.getElementById('gauge-speed-fill');
        if (gaugeFill) gaugeFill.style.strokeDashoffset = speedOffset;

        // RPM Gauge (Semi-Circle, length 251)
        if (this.els.gaugeRpm) this.els.gaugeRpm.textContent = Math.round(data.rpm);
        const rpmFill = document.getElementById('gauge-rpm-fill');
        if (rpmFill) {
            const maxRpm = 6000;
            const rpmPct = Math.min(data.rpm / maxRpm, 1);
            // 251 is full length. Offset 251 = empty. Offset 0 = full.
            const rpmOffset = 251 - (rpmPct * 251);
            rpmFill.style.strokeDashoffset = rpmOffset;
        }

        // Temp Gauge (Semi-Circle)
        if (this.els.gaugeTemp) this.els.gaugeTemp.textContent = Math.round(data.coolant);
        const tempFill = document.getElementById('gauge-temp-fill');
        if (tempFill) {
            const maxTemp = 130;
            const tempPct = Math.min(data.coolant / maxTemp, 1);
            const tempOffset = 251 - (tempPct * 251);
            tempFill.style.strokeDashoffset = tempOffset;

            // Dynamic Color for Temp
            if (data.coolant > 100) tempFill.style.stroke = '#ff2a2a'; // Red
            else if (data.coolant > 90) tempFill.style.stroke = '#ffc800'; // Amber
            else tempFill.style.stroke = '#00e5ff'; // Cyan
        }
    }

    updateMedium() {
        const data = this.sim.getData();
        if (this.els.coolant) this.els.coolant.textContent = Math.round(data.coolant);
        if (this.els.battery) this.els.battery.textContent = data.battery.toFixed(1);
    }

    updateAI() {
        // Only run expensive inference if we are on the AI page (optimization)
        if (!this.els.healthScore && !this.els.driverBadge) return;

        const result = this.ml.runInference();

        // 1. HEALTH CARD
        if (this.els.healthScore) {
            this.els.healthScore.textContent = result.scores.hygiene;

            let color = '#00ff41'; // Green
            let risk = 'Low';
            if (result.scores.hygiene < 80) { color = '#ffc800'; risk = 'Medium'; }
            if (result.scores.hygiene < 60) { color = '#ff2a2a'; risk = 'High'; }

            this.els.healthScore.style.color = color;
            if (this.els.healthRing) {
                this.els.healthRing.style.stroke = color;
                this.els.healthRing.style.strokeDasharray = `${result.scores.hygiene}, 100`;
            }
            if (this.els.healthRisk) {
                this.els.healthRisk.textContent = risk;
                this.els.healthRisk.style.color = color;
            }
            if (this.els.healthRul) this.els.healthRul.textContent = `${result.rul.val.toLocaleString()} km`;

            if (this.els.healthSummary) {
                if (risk === 'Low') this.els.healthSummary.textContent = "All systems operating within optimal parameters.";
                else if (risk === 'Medium') this.els.healthSummary.textContent = "Minor thermal irregularity detected. Monitoring.";
                else this.els.healthSummary.textContent = "Critical system stress detected. Maintainence required.";
            }
        }

        // 2. DRIVER CARD
        if (this.els.driverBadge) {
            this.els.driverBadge.textContent = result.driver.type;
            const type = result.driver.type;
            let impact = "Neutral";
            let color = "#fff";

            if (type.includes("AGGRESSIVE")) {
                impact = "+12% Consumption";
                color = "#ff2a2a";
            } else if (type.includes("ECO")) {
                impact = "-5% Consumption";
                color = "#00ff41";
            }

            if (this.els.fuelImpact) this.els.fuelImpact.textContent = impact;
            this.els.driverBadge.style.color = color;
            this.els.driverBadge.style.textShadow = `0 0 10px ${color}66`;

            if (this.els.driverConfVal) this.els.driverConfVal.textContent = result.driver.conf + "%";
            if (this.els.driverConfBar) this.els.driverConfBar.style.width = result.driver.conf + "%";
            if (this.els.driverSummary) this.els.driverSummary.textContent = result.driver.insight;
        }

        // 3. ANOMALY MONITOR
        if (this.els.anomalyStatus) {
            const data = this.sim.getData();
            let status = "SYSTEM NORMAL";
            let statusClass = "";
            let items = [];

            if (result.anomaly) {
                status = "ANOMALY DETECTED";
                statusClass = "critical";
                items.push({ icon: 'warning', class: 'issue', text: 'RPM Pattern Instability' });
            } else {
                items.push({ icon: 'check_circle', class: 'check', text: 'RPM Variance Nominal' });
            }

            if (data.coolant > 100) {
                status = "WARNING";
                if (statusClass !== 'critical') statusClass = "warning";
                items.push({ icon: 'warning', class: 'issue', text: 'Thermal Threshold Exceeded' });
            } else {
                items.push({ icon: 'check_circle', class: 'check', text: 'Thermal Gradient Stable' });
            }

            if (data.battery < 12.5) {
                items.push({ icon: 'bolt', class: 'issue', text: 'Voltage Drop Detected' });
            }

            this.els.anomalyStatus.className = `monitor-status ${statusClass}`;
            const txt = this.els.anomalyStatus.querySelector('.status-text');
            if (txt) txt.textContent = status;

            if (this.els.anomalyList) {
                this.els.anomalyList.innerHTML = items.map(i => `
                    <li><span class="material-icons ${i.class}">${i.icon}</span> ${i.text}</li>
                `).join('');
            }
        }

        // 4. RECOMMENDATIONS
        if (this.els.recsList) {
            const recs = [];
            if (result.driver.type.includes("AGGRESSIVE")) recs.push("Reduce throttle aggression to improve fuel economy.");
            else recs.push("Maintain current driving style for optimal battery/engine life.");

            if (result.scores.thermal < 90) recs.push("Check coolant levels during next stop.");

            this.els.recsList.innerHTML = recs.map(r => `
                <div class="rec-item">
                     <span class="material-icons icon">info</span>
                     <span class="text">${r}</span>
                </div>
            `).join('');
        }

        // Charts
        this.charts.anomaly.update(result.scores.hygiene); // Mock data for anomaly graph
    }
}

// Navigation now handled via standard HTML links
class TouchController {
    constructor() {
        // Legacy support if needed, or simple link highlighting
        const path = window.location.pathname;
        const page = path.split("/").pop();

        // Highlight logic could go here, but simple CSS classes on <a> tags is better
        // This class is hereby deprecated for the multi-page approach but kept empty to prevent crash not removed
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const sim = new MockOBDSimulator();
    const ml = new MLInferenceEngine(sim);
    const ui = new UIController(sim, ml);
    new TouchController();
    setInterval(() => { sim.tick(); ui.updateFast(); }, UPDATE_INTERVAL_MS);
    setInterval(() => ui.updateMedium(), MEDIUM_INTERVAL_MS);
    setInterval(() => ui.updateAI(), AI_INTERVAL_MS);
});
