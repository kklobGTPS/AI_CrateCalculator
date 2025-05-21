document.addEventListener('DOMContentLoaded', () => {
    const PLYWOOD_THICKNESS = 0.625; // 5/8 inches
    const TWOBYFOUR_NOMINAL_THICKNESS = 2; // inches
    const TWOBYFOUR_NOMINAL_WIDTH = 4; // inches
    const SKID_PLYWOOD_WIDTH = 3.5; // inches

    const PLYWOOD_WEIGHT_PER_SQ_FT = 1.8; // lbs
    const TWOBYFOUR_WEIGHT_PER_LINEAL_FOOT = 1.3; // lbs

    let bracingListArray = [];

    // DOM Elements
    const form = document.getElementById('crateForm');
    const internalLInput = document.getElementById('internalL');
    const internalWInput = document.getElementById('internalW');
    const internalHInput = document.getElementById('internalH');
    const cargoWeightInput = document.getElementById('cargoWeight');

    const bracingLengthInput = document.getElementById('bracingLength');
    const bracingQuantityInput = document.getElementById('bracingQuantity');
    const addBracingBtn = document.getElementById('addBracingBtn');
    const bracingListDiv = document.getElementById('bracingList');
    const noBracingMessage = document.getElementById('noBracingMessage');

    const resetBtn = document.getElementById('resetBtn');

    const outputSection = document.getElementById('outputSection');
    const projTotalWeightOutput = document.getElementById('projTotalWeightOutput');
    const boardFootageOutput = document.getElementById('boardFootageOutput');

    // Error message elements
    const internalLError = document.getElementById('internalLError');
    const internalWError = document.getElementById('internalWError');
    const internalHError = document.getElementById('internalHError');
    const cargoWeightError = document.getElementById('cargoWeightError');
    const bracingLengthError = document.getElementById('bracingLengthError');
    const bracingQuantityError = document.getElementById('bracingQuantityError');

    function parseMixedFraction(inputStr) {
        const str = String(inputStr).trim();
        if (str === '') return NaN;

        const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
        if (mixedMatch) {
            const whole = parseInt(mixedMatch[1], 10);
            const num = parseInt(mixedMatch[2], 10);
            const den = parseInt(mixedMatch[3], 10);
            if (den === 0 || isNaN(whole) || isNaN(num) || isNaN(den)) return NaN;
            return whole + num / den;
        }

        const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
        if (fractionMatch) {
            const num = parseInt(fractionMatch[1], 10);
            const den = parseInt(fractionMatch[2], 10);
            if (den === 0 || isNaN(num) || isNaN(den)) return NaN;
            return num / den;
        }

        const num = parseFloat(str);
        return !isNaN(num) ? num : NaN;
    }

    function displayError(element, message) {
        if (element) {
            element.textContent = message;
        }
    }

    function clearError(element) {
        if (element) {
            element.textContent = '';
        }
    }
    
    function clearAllErrors() {
        displayError(internalLError, '');
        displayError(internalWError, '');
        displayError(internalHError, '');
        displayError(cargoWeightError, '');
        displayError(bracingLengthError, '');
        displayError(bracingQuantityError, '');
    }

    function renderBracingList() {
        bracingListDiv.innerHTML = ''; // Clear existing items
        if (bracingListArray.length === 0) {
            noBracingMessage.style.display = 'block';
            return;
        }
        noBracingMessage.style.display = 'none';

        bracingListArray.forEach(piece => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'bracing-item';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = `Qty: ${piece.quantity}, Length: ${piece.length} inches each`;
            
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'danger-button';
            removeButton.textContent = 'Remove';
            removeButton.setAttribute('aria-label', `Remove ${piece.quantity} bracing pieces of ${piece.length} inches`);
            removeButton.onclick = () => {
                bracingListArray = bracingListArray.filter(p => p.id !== piece.id);
                renderBracingList();
            };
            
            itemDiv.appendChild(textSpan);
            itemDiv.appendChild(removeButton);
            bracingListDiv.appendChild(itemDiv);
        });
    }

    addBracingBtn.addEventListener('click', () => {
        clearError(bracingLengthError);
        clearError(bracingQuantityError);

        const lengthStr = bracingLengthInput.value;
        const quantityStr = bracingQuantityInput.value;

        const length = parseMixedFraction(lengthStr);
        const quantity = parseInt(quantityStr, 10);

        let isValid = true;
        if (isNaN(length) || length <= 0) {
            displayError(bracingLengthError, "Length must be a positive number or fraction.");
            isValid = false;
        }
        if (isNaN(quantity) || quantity <= 0) {
            displayError(bracingQuantityError, "Quantity must be a positive integer.");
            isValid = false;
        }

        if (isValid) {
            bracingListArray.push({ id: Date.now().toString(), length, quantity });
            renderBracingList();
            bracingLengthInput.value = '';
            bracingQuantityInput.value = '';
        }
    });

    function validateInputs() {
        clearAllErrors();
        let isValid = true;

        const l = parseMixedFraction(internalLInput.value);
        const w = parseMixedFraction(internalWInput.value);
        const h = parseMixedFraction(internalHInput.value);
        const weightStr = cargoWeightInput.value;
        
        if (isNaN(l) || l <= 0) {
            displayError(internalLError, "Length must be a positive number or fraction.");
            isValid = false;
        }
        if (isNaN(w) || w <= 0) {
            displayError(internalWError, "Width must be a positive number or fraction.");
            isValid = false;
        }
        if (isNaN(h) || h <= 0) {
            displayError(internalHError, "Height must be a positive number or fraction.");
            isValid = false;
        }

        if (weightStr !== '') {
            const weight = parseFloat(weightStr);
            if (isNaN(weight) || weight < 0) {
                displayError(cargoWeightError, "Weight must be a non-negative number if entered.");
                isValid = false;
            }
        }
        return isValid;
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validateInputs()) {
            outputSection.classList.add('empty');
            return;
        }

        const L = parseMixedFraction(internalLInput.value);
        const W = parseMixedFraction(internalWInput.value);
        const H = parseMixedFraction(internalHInput.value);
        const initialCargoWeight = parseFloat(cargoWeightInput.value) || 0;

        const plywoodBoxL = L;
        const plywoodBoxW = W + (2 * PLYWOOD_THICKNESS);

        const feet2x4Length = 3 * plywoodBoxW;
        const bracing2x4Length = bracingListArray.reduce((sum, piece) => sum + (piece.length * piece.quantity), 0);
        const total2x4LengthInches = feet2x4Length + bracing2x4Length;
        const boardFootage = (total2x4LengthInches * TWOBYFOUR_NOMINAL_THICKNESS * TWOBYFOUR_NOMINAL_WIDTH) / 144;

        const areaFrontBack = 2 * L * H;
        const areaSides = 2 * W * H;
        const areaTopBottom = 2 * L * plywoodBoxW;
        const areaSkids = 2 * plywoodBoxL * SKID_PLYWOOD_WIDTH;
        
        const totalPlywoodAreaSqIn = areaFrontBack + areaSides + areaTopBottom + areaSkids;
        const totalPlywoodAreaSqFt = totalPlywoodAreaSqIn / 144;
        const cratePlywoodWeight = totalPlywoodAreaSqFt * PLYWOOD_WEIGHT_PER_SQ_FT;

        const total2x4LengthFt = total2x4LengthInches / 12;
        const crate2x4Weight = total2x4LengthFt * TWOBYFOUR_WEIGHT_PER_LINEAL_FOOT;

        const projTotalWeight = initialCargoWeight + cratePlywoodWeight + crate2x4Weight;

        projTotalWeightOutput.innerHTML = `<strong>Projected Total Weight:</strong> ${Math.ceil(projTotalWeight)} lbs`;
        boardFootageOutput.innerHTML = `<strong>Required 2x4 Board Footage:</strong> ${parseFloat(boardFootage.toFixed(2))} BF`;
        outputSection.classList.remove('empty');
    });

    resetBtn.addEventListener('click', () => {
        form.reset(); // Resets all form fields
        bracingListArray = [];
        renderBracingList();
        clearAllErrors();
        outputSection.classList.add('empty');
        projTotalWeightOutput.innerHTML = '';
        boardFootageOutput.innerHTML = '';
    });

    // Clear errors on input
    [internalLInput, internalWInput, internalHInput, cargoWeightInput, bracingLengthInput, bracingQuantityInput].forEach(input => {
        input.addEventListener('input', () => {
            const errorElId = input.id + 'Error';
            const errorEl = document.getElementById(errorElId);
            if (errorEl) clearError(errorEl);
        });
    });
    
    // Initial render for bracing list (to show "No additional bracing added.")
    renderBracingList();
});
