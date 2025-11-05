// --- Constants and Material Data ---
        const EPSILON_0 = 8.854e-12;
        const L_FACTOR_PER_M = 2e-7;
        const GMR_FACTOR = 0.7788;

        const materialData = {
            "Copper (Annealed)": { "rho": 1.7200, "T0": 234.5000 },
            "Hard-drawn Aluminum": { "rho": 2.83, "T0": 228.1 },
            "Hard-drawn Copper": { "rho": 1.77, "T0": 241.5 }
        };

        const materialSelect = document.getElementById('material');
        for (const [name, data] of Object.entries(materialData)) {
            const option = document.createElement('option');
            option.value = JSON.stringify(data);
            option.textContent = name;
            materialSelect.appendChild(option);
        }
        materialSelect.value = JSON.stringify(materialData["Copper (Annealed)"]);


        // --- Core Logic for UI and Data Handling ---

        function getNum(id) {
            const val = parseFloat(document.getElementById(id).value);
            return isNaN(val) ? 0 : val;
        }

        /** Calculates separate GMDs for Inductance (GMD_L) and Capacitance (GMD_C) */
        function calculateGMDs(arrangement) {
            const D_eq = getNum('spacing');
            const D_ab = getNum('spacing_ab');
            const D_bc = getNum('spacing_bc');
            const D_ca = getNum('spacing_ca');
            const h = getNum('height');
            
            let GMD_L = 0;
            let GMD_C = 0;

            if (arrangement === '1P_SYMM') {
                GMD_L = D_eq;
                GMD_C = 2 * h;
            } else if (arrangement === '3P_SYMM') {
                GMD_L = D_eq;
                GMD_C = D_eq;
            } else if (arrangement === '3P_UNSYMM') {
                if (D_ab > 0 && D_bc > 0 && D_ca > 0) {
                    const GMD = Math.pow(D_ab * D_bc * D_ca, 1/3);
                    GMD_L = GMD;
                    GMD_C = GMD;
                } else {
                    GMD_L = 0;
                    GMD_C = 0;
                }
            }
            return { GMD_L, GMD_C };
        }

        // --- Calculation Functions ---

        function calculateR(r, lineLength_km, T_op) {
            const rho = getNum('rho');
            const T0 = getNum('T0');
            if (r <= 0 || rho <= 0 || T0 <= 0) return { R_per_km: 0, R_total: 0 };
            const A = Math.PI * r * r;
            const T_ref = 20;
            const fT = (T_op + T0) / (T_ref + T0);
            const rho_si = rho * 1e-8;
            const R_per_km = (rho_si / A) * fT * 1000;
            const R_total = R_per_km * lineLength_km;
            return { R_per_km, R_total };
        }

        function calculateL(r, lineLength_km, GMD_L) {
            const GMR = GMR_FACTOR * r;
            if (GMR <= 0 || GMD_L <= 0 || GMD_L <= GMR) return { L_per_km: 0, L_total: 0 };
            const ratio = GMD_L / GMR;
            const L_per_m = L_FACTOR_PER_M * Math.log(ratio);
            const L_per_km = L_per_m * 1000;
            const L_total = L_per_km * lineLength_km;
            return { L_per_km, L_total };
        }

        /** Includes the constraint GMD > r for a valid positive capacitance. */
        function calculateC(r, lineLength_km, GMD_C) {
            if (r <= 0 || GMD_C <= 0 || GMD_C <= r) return { C_per_km: 0, C_total: 0 };

            const numerator = 2 * Math.PI * EPSILON_0;
            const denominator = Math.log(GMD_C / r);

            const C_per_m = numerator / denominator;
            
            const C_per_km = C_per_m * 1000;
            const C_total = C_per_km * lineLength_km;

            return { C_per_km, C_total };
        }

        // --- Formatting Functions (Aligned to Lab Output) ---
        
        const precision = 6;

        const formatOutput = (value, unit, isExponential = false) => {
            if (value === null || isNaN(value) || value <= 1e-12) return '-';
            if (isExponential) return value.toExponential(6) + " " + unit;
            return value.toFixed(precision) + " " + unit;
        };
        
        /** Helper to format Inductance to milliHenries (mH) */
        const formatInductanceMilli = (value, unit) => {
            if (value === null || isNaN(value) || value <= 1e-12) return '-';
            const milliValue = value * 1e3;
            return milliValue.toFixed(precision) + " " + unit;
        };


        /** Helper to format Capacitance to Microfarads (µF) */
        const formatCapacitanceMicro = (value, unit) => {
            if (value === null || isNaN(value) || value <= 1e-15) return '-';
            const microValue = value * 1e6;
            return microValue.toFixed(precision) + " " + unit;
        };

        // --- Main Logic ---

        function updateAllCalculations() {
            const arrangement = document.getElementById('phaseArrangement').value;
            const r = getNum('conductorRadius');
            const T_op = getNum('operatingTemp');
            const lineLength_km = getNum('lineLength');
            const selectedParam = document.getElementById('computeParameter').value;
            
            const { GMD_L, GMD_C } = calculateGMDs(arrangement);
            
            let { R_per_km, R_total } = calculateR(r, lineLength_km, T_op);
            let { L_per_km, L_total } = calculateL(r, lineLength_km, GMD_L);
            let { C_per_km, C_total } = calculateC(r, lineLength_km, GMD_C);


            // --- Output Results ---
            
            document.getElementById('r-per-km').textContent = formatOutput(R_per_km, "Ω/km");
            document.getElementById('l-per-km').textContent = formatInductanceMilli(L_per_km, "mH/km");
            document.getElementById('c-per-km').textContent = formatCapacitanceMicro(C_per_km, "µF/km");

            document.getElementById('r-total').textContent = formatOutput(R_total, "Ω");
            document.getElementById('l-total').textContent = formatInductanceMilli(L_total, "mH");
            document.getElementById('c-total').textContent = formatCapacitanceMicro(C_total, "µF");

            applyParameterFilter(selectedParam);
        }

        /** Toggles the visibility of spacing inputs. */
        function toggleSpacingInputs() {
            const arrangement = document.getElementById('phaseArrangement').value;
            const equalSpacing = document.getElementById('equal-spacing-input');
            const unsymAB = document.getElementById('unsym-ab');
            const unsymBC = document.getElementById('unsym-bc');
            const unsymCA = document.getElementById('unsym-ca');
            
            const isUnsymm = arrangement === '3P_UNSYMM';
            
            equalSpacing.classList.toggle('hidden', isUnsymm);
            
            unsymAB.classList.toggle('hidden', !isUnsymm);
            unsymBC.classList.toggle('hidden', !isUnsymm);
            unsymCA.classList.toggle('hidden', !isUnsymm);

            updateAllCalculations();
        }
        
        function applyParameterFilter(selectedParam) {
            const R_results = document.querySelectorAll('.r-result');
            const L_results = document.querySelectorAll('.l-result');
            const C_results = document.querySelectorAll('.c-result');
            
            const isAll = selectedParam === 'ALL';
            
            const toggle = (elements, show) => {
                elements.forEach(el => el.classList.toggle('hidden', !show));
            };
            
            toggle(R_results, isAll || selectedParam === 'R');
            toggle(L_results, isAll || selectedParam === 'L');
            toggle(C_results, isAll || selectedParam === 'C');
        }

        function handleMaterialChange() {
            const materialSelect = document.getElementById('material');
            try {
                const materialData = JSON.parse(materialSelect.value);
                document.getElementById('rho').value = materialData.rho.toFixed(4);
                document.getElementById('T0').value = materialData.T0.toFixed(4);
            } catch (e) {
                console.error("Error parsing material data:", e);
            }
            updateAllCalculations();
        }


        // --- Event Listeners and Initialization ---
        document.addEventListener('DOMContentLoaded', () => {
            const inputs = document.querySelectorAll('input[type="number"], select');
            inputs.forEach(input => {
                input.addEventListener('input', updateAllCalculations);
                input.addEventListener('change', updateAllCalculations);
            });

            document.getElementById('phaseArrangement').addEventListener('change', toggleSpacingInputs);
            document.getElementById('computeParameter').addEventListener('change', updateAllCalculations);
            document.getElementById('material').addEventListener('change', handleMaterialChange);

            // Initialize UI and Calculation
            handleMaterialChange();
            toggleSpacingInputs();
        });