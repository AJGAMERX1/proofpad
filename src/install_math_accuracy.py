"""Keep exact matrix entries across calculator actions and compile named derivatives."""
from pathlib import Path

HERE = Path(__file__).resolve().parent


def install_math_accuracy(source):
    def change(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError('Unexpected math accuracy integration point: ' + old[:90])
        source = source.replace(old, new, 1)

    start = source.index(' function evaluate(expr){', source.index('function calculateNotebook('))
    end = source.index(' function resolve(symbol){', start)
    change(source[start:end], (HERE / 'matrix-accuracy.js').read_text())
    start = source.index('   const result=entry.symbol?resolve(entry.symbol):evaluate(entry.expr);')
    end = source.index('   const real=result.re', start)
    change(source[start:end], """   const {exact,value:result}=entry.symbol?resolve(entry.symbol):evaluate(entry.expr);
   if(result.operator==='List')return {...matrixAnswer(exact,result),symbol:entry.symbol||null};
""")
    change("function buildCalculatorRow(row){", """function buildCalculatorRow(row){
 row.addEventListener('pointerdown',()=>{
  const field=row.querySelector('math-field');
  if(field && active!==field)choose(field);
 },true);""")
    change("$('#calcCopyResult').onclick=", "$('#calcCopyResult').onpointerdown=event=>event.preventDefault();\n$('#calcCopyResult').onclick=")
    change("await copyText(result.latex)?", r"await copyText(result.matrix&&result.approx?'\\approx '+result.latex:result.latex)?")
    change("data.matrix.join(' × ')+' matrix';", "(data.approx?'Approximate ':'')+data.matrix.join(' × ')+' matrix';")
    change("catch{output.textContent='= '+data.latex}", "catch{output.textContent=(data.approx?'≈ ':'= ')+data.latex}")
    change(' const scalarPreviews=[];', ' const derivatives=new Map();\n' + (HERE / 'named-derivatives.js').read_text() + ' const scalarPreviews=[];')
    change('scalarPreviews[index]=plan;});', 'scalarPreviews[index]=plan;},namedDerivative);')
    change('onNumericCall=null, onScalarPreview=null) {', 'onNumericCall=null, onScalarPreview=null, differentiate=null) {')
    change(' const variables=new Map(), functions=new Map();', ' const variables=new Map(), functions=new Map();\n let primeParameter;')
    change("  if (op==='Apply' && args.length===2 && args[0]?.[0]==='InverseFunction'", """  if (op==='Apply' && args[0]?.[0]==='Derivative') {
   const [,name,order=1]=args[0], fn=functions.get(name);
   if(!fn)throw Error('Define '+name+' as a function of one variable, for example '+name+'(t)=t².');
   checkFunction(name,fn);
   if(fn.params.length!==1 || args.length!==2 || args[1]?.[0]==='Sequence')throw Error('Prime notation takes one function parameter and one argument.');
   if(!differentiate)throw Error('Named derivatives require the calculator worker.');
   if(!primeParameter){
    primeParameter='ProofpadDerivativeVariable';
    while(nodes.some(node=>uses(node,primeParameter)))primeParameter+='X';
   }
   const parameter=primeParameter;
   const bodyBudget={remaining:Math.min(500,budget.remaining),numeric:true};
   const scope=new Map([[fn.params[0],{expr:parameter,cost:1}]]);
   const body=expand(name,fn,scope,visiting,bodyBudget);
   const derivative=differentiate(body,parameter,order);
   const before=budget.remaining;
   const argument=build(args[1],bindings,visiting,budget);
   return build(derivative,new Map([[parameter,{expr:argument,cost:before-budget.remaining}]]),visiting,budget);
  }
  if (op==='Apply' && args.length===2 && args[0]?.[0]==='InverseFunction'""")
    change("  if(node[0]==='InvisibleOperator'){\n   for(let i=1;i<node.length-1;i++){",
           "  if(node[0]==='Apply' && node[1]?.[0]==='Derivative')return true;\n  if(node[0]==='InvisibleOperator'){\n   for(let i=1;i<node.length-1;i++){")
    change(' if(onNumericCall && functions.size){',' if(onNumericCall){')
    return source
