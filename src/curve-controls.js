const defaultCurveRange = Object.freeze({min:'-2π', max:'2π'});
const defaultCurveInterval = Object.freeze([-2 * Math.PI, 2 * Math.PI]);
const curveIntervalCache = new WeakMap();
let curveRangeId = 0;

// A row owns its input strings. Samples, Fit and Trace share the same interval.
function graphCurveRange(series) {
 const range = series.row.curveRange;
 if (!range) return defaultCurveInterval;
 if (!curveIntervalCache.has(range)) {
  const min = parseCurveParameter(range.min), max = parseCurveParameter(range.max);
  curveIntervalCache.set(range, Number.isFinite(min) && Number.isFinite(max) && min < max ? [min,max] : null);
 }
 return curveIntervalCache.get(range);
}

function validSavedCurveRange(range) {
 return range && ['min','max'].every(key => typeof range[key] === 'string' && range[key].length <= 160);
}

function syncCurveRangeControls(row, isCurve) {
 let controls = row.querySelector('.curve-domain');
 if (!isCurve) { controls?.remove(); return; }
 if (controls) return;
 controls = document.createElement('div');
 controls.className = 'curve-domain';
 controls.setAttribute('role','group');
 controls.setAttribute('aria-label','Curve parameter range');
 const min = document.createElement('input'), max = document.createElement('input');
 const bounds = row.curveRange || defaultCurveRange;
 const separator = document.createElement('span');
 separator.textContent = '≤ t ≤';
 separator.setAttribute('aria-hidden','true');
 const error = document.createElement('span');
 error.className = 'curve-range-error';
 error.id = 'curve-range-error-' + (++curveRangeId);
 error.setAttribute('role','status');
 for (const [key,input,label] of [['min',min,'Minimum t'],['max',max,'Maximum t']]) {
  input.type = 'text';
  input.dataset.curveBound = key;
  input.setAttribute('aria-label',label);
  input.setAttribute('aria-describedby',error.id);
  input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('autocapitalize','off');
  input.maxLength = 160; input.value = bounds[key];
 }
 controls.append(min,separator,max,error);
 row.append(controls);

 function showValidation() {
  const valid = !!graphCurveRange({row});
  for (const input of [min,max]) input.setAttribute('aria-invalid', String(!valid));
  error.textContent = valid ? '' : 'Enter two finite bounds with minimum t smaller than maximum t.';
  return valid;
 }
 showValidation();
 controls.addEventListener('input', () => {
  row.curveRange = {min:min.value, max:max.value};
  const valid = showValidation();
  if (row.calcResult?.plotOnly) {
   const output = row.querySelector('.calc-result');
   output.textContent = valid ? 'Plotted' : 'Check t range';
   output.setAttribute('aria-label',output.textContent);
  }
  queueHistory(); persist(); redrawGraph();
 });
}
