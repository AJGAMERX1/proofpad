"""Evaluate calculus inside the calculator worker before compiling graph rows."""
from pathlib import Path

HERE = Path(__file__).resolve().parent


def install_audit_calculator(source):
    def change(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError('Calculator audit hook: ' + old[:90])
        source = source.replace(old, new, 1)

    change(' const scalarPreviews=[];', (HERE / 'calculus.js').read_text() + '''
 // A symbolic derivative can be graphed with its reduced expression tree. A
 // failed integral keeps its own diagnostic even when the integrand contains x.
 parsed.forEach((entry,index)=>{
  if(!entry.expr)return;
  try {
   const prepared=prepareCalculus(entry.expr);
   if(!prepared)return;
   const tree=prepared.value.json;
   graphNodes[index]=entry.symbol?['Equal',entry.symbol,tree]:tree;
  } catch(error) {
   parsed[index]={error:error.message};
   graphNodes[index]=null;
  }
 });
 const scalarPreviews=[];''')

    change('   const real=result.re,imag=result.im,bool=', '''   if(result.unknowns.length)return {latex:exact.latex,symbol:entry.symbol||null,symbolic:true,approx:false};
   const real=result.re,imag=result.im,bool=''')
    change('   const latex=bool?', '''   const exactScalar=imag===0 && (exact.operator==='Rational' || exact.numericValue?.isExact===true ||
     (exact.operator==='Integer' && Number.isSafeInteger(real)));
   const literalValue=entry.expr.json;
   const literalDecimal=typeof literalValue==='number' && literalValue===real && Number(real.toPrecision(digits))===real;
   const latex=exactScalar?exact.latex:bool?''')
    change('approx:!bool&&imag===0&&!Number.isInteger(real)', 'approx:!bool&&imag===0&&!exactScalar&&!literalDecimal')
    return source
