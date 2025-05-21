import React, { useState, ChangeEvent, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';

const PLYWOOD_THICKNESS = 0.625; // 5/8 inches
const TWOBYFOUR_NOMINAL_THICKNESS = 2; // inches
const TWOBYFOUR_NOMINAL_WIDTH = 4; // inches
// const TWOBYFOUR_ACTUAL_WIDTH_FOR_FEET = 3.5; // inches (height contribution of feet) - Not directly used in output, but feet exist
const SKID_PLYWOOD_WIDTH = 3.5; // inches (assumed width of plywood skids)

const PLYWOOD_WEIGHT_PER_SQ_FT = 1.8; // lbs
const TWOBYFOUR_WEIGHT_PER_LINEAL_FOOT = 1.3; // lbs

interface BracingPiece {
  id: string;
  length: number;
  quantity: number;
}

interface CrateOutputs {
  projTotalWeight: number;
  boardFootage: number;
}

// Helper function to parse mixed fractions
function parseMixedFraction(inputStr: string): number {
  const str = inputStr.trim();
  if (str === '') return NaN;

  // Check for mixed fraction: "INT SPACE FRACTION" e.g., "10 3/4"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den === 0 || isNaN(whole) || isNaN(num) || isNaN(den)) return NaN;
    return whole + num / den;
  }

  // Check for simple fraction: "NUM/DEN" e.g., "3/4"
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const den = parseInt(fractionMatch[2], 10);
    if (den === 0 || isNaN(num) || isNaN(den)) return NaN;
    return num / den;
  }

  // Check for decimal or whole number
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return num;
  }

  return NaN;
}


const App: React.FC = () => {
  const [internalL, setInternalL] = useState<string>('');
  const [internalW, setInternalW] = useState<string>('');
  const [internalH, setInternalH] = useState<string>('');
  const [cargoWeight, setCargoWeight] = useState<string>('');

  const [bracingLength, setBracingLength] = useState<string>('');
  const [bracingQuantity, setBracingQuantity] = useState<string>('');
  const [bracingList, setBracingList] = useState<BracingPiece[]>([]);

  const [outputs, setOutputs] = useState<CrateOutputs | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateInputs = (): boolean => {
    const newErrors: Record<string, string> = {};
    const parsedL = parseMixedFraction(internalL);
    const parsedW = parseMixedFraction(internalW);
    const parsedH = parseMixedFraction(internalH);

    if (isNaN(parsedL) || parsedL <= 0) newErrors.internalL = "Length must be a positive number or fraction.";
    if (isNaN(parsedW) || parsedW <= 0) newErrors.internalW = "Width must be a positive number or fraction.";
    if (isNaN(parsedH) || parsedH <= 0) newErrors.internalH = "Height must be a positive number or fraction.";
    
    const parsedCargoWeight = parseFloat(cargoWeight);
    if (cargoWeight !== '' && (isNaN(parsedCargoWeight) || parsedCargoWeight < 0)) {
      newErrors.cargoWeight = "Weight must be a non-negative number.";
    } else if (cargoWeight === '') {
       // Allow empty cargo weight, treat as 0
    }
    
    setErrors(prev => ({...prev, ...newErrors})); // Merge with existing bracing errors
    // Check only main dimension errors for overall validation pass
    const mainDimensionErrors = ['internalL', 'internalW', 'internalH', 'cargoWeight'].some(key => newErrors[key]);
    return !mainDimensionErrors && Object.values(errors).every(err => !err); // Ensure no existing errors persist
  };

  const handleAddBracing = () => {
    const length = parseMixedFraction(bracingLength);
    const quantity = parseInt(bracingQuantity, 10);
    const newBracingErrors: Record<string, string> = {};

    if (isNaN(length) || length <= 0) newBracingErrors.bracingLength = "Length must be a positive number or fraction.";
    if (isNaN(quantity) || quantity <= 0) newBracingErrors.bracingQuantity = "Quantity must be a positive integer.";
    
    setErrors(prev => ({...prev, bracingLength: newBracingErrors.bracingLength, bracingQuantity: newBracingErrors.bracingQuantity}));

    if (Object.keys(newBracingErrors).length > 0) return;

    setBracingList([...bracingList, { id: Date.now().toString(), length, quantity }]);
    setBracingLength('');
    setBracingQuantity('');
    // Clear only bracing errors after successful add
    setErrors(prev => ({...prev, bracingLength: undefined, bracingQuantity: undefined}));
  };

  const handleRemoveBracing = (id: string) => {
    setBracingList(bracingList.filter(piece => piece.id !== id));
  };

  const handleCalculate = (e: FormEvent) => {
    e.preventDefault();
    // Clear previous calculation errors before re-validating
    setErrors(prev => {
        const clearedCalcErrors = {...prev};
        delete clearedCalcErrors.internalL;
        delete clearedCalcErrors.internalW;
        delete clearedCalcErrors.internalH;
        delete clearedCalcErrors.cargoWeight;
        return clearedCalcErrors;
    });

    if (!validateInputs()) {
      setOutputs(null);
      return;
    }

    const L = parseMixedFraction(internalL);
    const W = parseMixedFraction(internalW);
    const H = parseMixedFraction(internalH);
    // If cargoWeight is empty or invalid, default to 0. Validation should catch invalid.
    const initialCargoWeight = parseFloat(cargoWeight) || 0;

    if (isNaN(L) || isNaN(W) || isNaN(H)) { // Should be caught by validateInputs, but as a safeguard
        setOutputs(null);
        return;
    }

    // Plywood Box outer footprint dimensions (used for feet, skids, and top/bottom plywood)
    const plywoodBoxL = L; // Length is 'clean'
    const plywoodBoxW = W + (2 * PLYWOOD_THICKNESS); // Width accounts for side panel assembly

    // 2x4s for Feet (run along the width of the crate)
    const feet2x4Length = 3 * plywoodBoxW;

    // User-added bracing
    const bracing2x4Length = bracingList.reduce((sum, piece) => sum + (piece.length * piece.quantity), 0);
    
    // Total 2x4 Length (No internal cleats)
    const total2x4LengthInches = feet2x4Length + bracing2x4Length;

    // Board Footage
    const boardFootage = (total2x4LengthInches * TWOBYFOUR_NOMINAL_THICKNESS * TWOBYFOUR_NOMINAL_WIDTH) / 144;

    // Plywood Material Calculation (for weight)
    // Area of Front/Back panels (Internal L x Internal H)
    const areaFrontBack = 2 * L * H;
    // Area of Side panels (Internal W x Internal H)
    const areaSides = 2 * W * H;
    // Area of Top/Bottom panels (Internal L x Plywood Box Width)
    const areaTopBottom = 2 * L * plywoodBoxW;
    // Area of Skids (run along the length of the crate)
    const areaSkids = 2 * plywoodBoxL * SKID_PLYWOOD_WIDTH; 
    
    const totalPlywoodAreaSqIn = areaFrontBack + areaSides + areaTopBottom + areaSkids;
    const totalPlywoodAreaSqFt = totalPlywoodAreaSqIn / 144;
    const cratePlywoodWeight = totalPlywoodAreaSqFt * PLYWOOD_WEIGHT_PER_SQ_FT;

    // 2x4 Material Weight
    const total2x4LengthFt = total2x4LengthInches / 12;
    const crate2x4Weight = total2x4LengthFt * TWOBYFOUR_WEIGHT_PER_LINEAL_FOOT;

    // Projected Total Weight
    const projTotalWeight = initialCargoWeight + cratePlywoodWeight + crate2x4Weight;
    
    setOutputs({
      projTotalWeight: Math.ceil(projTotalWeight),
      boardFootage: parseFloat(boardFootage.toFixed(2)),
    });
  };

  const handleReset = () => {
    setInternalL('');
    setInternalW('');
    setInternalH('');
    setCargoWeight('');
    setBracingLength('');
    setBracingQuantity('');
    setBracingList([]);
    setOutputs(null);
    setErrors({});
  };

  const createInputHandler = (setter: React.Dispatch<React.SetStateAction<string>>, fieldName?: keyof typeof errors) => 
    (e: ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      if (fieldName && errors[fieldName]) {
        setErrors(prev => ({...prev, [fieldName]: undefined }));
      }
  };

  return (
    <>
      <h1>Warehouse Crate Calculator</h1>
      <form onSubmit={handleCalculate}>
        <h2>Required Internal Dimensions & Cargo Weight</h2>
        <div className="input-group">
          <label htmlFor="internalL">Internal Length (L, inches):</label>
          <input type="text" id="internalL" value={internalL} onChange={createInputHandler(setInternalL, 'internalL')} placeholder="e.g., 15 or 15 3/4" aria-required="true" aria-describedby="internalLError" />
          {errors.internalL && <p className="error-message" id="internalLError">{errors.internalL}</p>}
        </div>
        <div className="input-group">
          <label htmlFor="internalW">Internal Width (W, inches):</label>
          <input type="text" id="internalW" value={internalW} onChange={createInputHandler(setInternalW, 'internalW')} placeholder="e.g., 10.5 or 10 1/2" aria-required="true" aria-describedby="internalWError"/>
          {errors.internalW && <p className="error-message" id="internalWError">{errors.internalW}</p>}
        </div>
        <div className="input-group">
          <label htmlFor="internalH">Internal Height (H, inches):</label>
          <input type="text" id="internalH" value={internalH} onChange={createInputHandler(setInternalH, 'internalH')} placeholder="e.g., 8 or 8 1/4" aria-required="true" aria-describedby="internalHError"/>
          {errors.internalH && <p className="error-message" id="internalHError">{errors.internalH}</p>}
        </div>
        <div className="input-group">
          <label htmlFor="cargoWeight">Estimated Cargo Weight (lbs):</label>
          <input type="number" id="cargoWeight" value={cargoWeight} onChange={createInputHandler(setCargoWeight, 'cargoWeight')} min="0" step="any" placeholder="e.g., 150" aria-describedby="cargoWeightError"/>
          {errors.cargoWeight && <p className="error-message" id="cargoWeightError">{errors.cargoWeight}</p>}
        </div>

        <h2>Additional 2x4 Bracing</h2>
        <div className="input-group" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ flexGrow: 1 }}>
            <label htmlFor="bracingLength">Bracing Length (inches):</label>
            <input type="text" id="bracingLength" value={bracingLength} onChange={createInputHandler(setBracingLength, 'bracingLength')} placeholder="e.g., 12 or 12 1/2" aria-describedby="bracingLengthError"/>
            {errors.bracingLength && <p className="error-message" id="bracingLengthError">{errors.bracingLength}</p>}
          </div>
          <div style={{ flexGrow: 1 }}>
            <label htmlFor="bracingQuantity">Quantity:</label>
            <input type="number" id="bracingQuantity" value={bracingQuantity} onChange={createInputHandler(setBracingQuantity, 'bracingQuantity')} min="1" step="1" placeholder="e.g., 4" aria-describedby="bracingQuantityError"/>
            {errors.bracingQuantity && <p className="error-message" id="bracingQuantityError">{errors.bracingQuantity}</p>}
          </div>
          <button type="button" onClick={handleAddBracing} className="primary-button" style={{height: '42px', whiteSpace: 'nowrap', marginTop:'auto', marginBottom:'auto'  }}>Add Bracing</button>
        </div>
        {bracingList.length > 0 && (
          <div className="bracing-list-container">
            <h3>Current Additional Bracing:</h3>
            {bracingList.map(piece => (
              <div key={piece.id} className="bracing-item">
                <span>Qty: {piece.quantity}, Length: {piece.length} inches each</span>
                <button type="button" onClick={() => handleRemoveBracing(piece.id)} className="danger-button" aria-label={`Remove ${piece.quantity} bracing pieces of ${piece.length} inches`}>Remove</button>
              </div>
            ))}
          </div>
        )}
         {bracingList.length === 0 && <p>No additional bracing added.</p>}


        <div className="button-group">
          <button type="submit" className="primary-button">Calculate Crate Specs</button>
          <button type="button" onClick={handleReset} className="secondary-button">Reset Form</button>
        </div>
      </form>

      {outputs && (
        <section className="output-section" aria-live="polite">
          <h2>Projected Crate Specifications</h2>
          <div><strong>Projected Total Weight:</strong> {outputs.projTotalWeight} lbs</div>
          <div><strong>Required 2x4 Board Footage:</strong> {outputs.boardFootage} BF</div>
        </section>
      )}
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
