const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file];if(file.endsWith('.json'))return cache[file]=JSON.parse(fs.readFileSync(file,'utf8'));const mod={exports:{}};cache[file]=mod.exports;const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext('(function(require,module,exports){'+compiled+'})',{console,URL,Intl,Date,Map,Set})(name=>{if(!name.startsWith('.'))return require(name);const base=path.resolve(path.dirname(file),name);return load([base,base+'.ts',base+'.tsx',base+'.json'].find(f=>fs.existsSync(f)))},mod,mod.exports);cache[file]=mod.exports;return mod.exports}
const {setActiveLanguage,localize}=load('app/lib/i18n.ts'),{NewHome}=load('app/components/Upgrade.tsx'),{CarePanel}=load('app/components/CarePanel.tsx'),{exercises}=load('app/lib/content.ts');
function home(){return renderToStaticMarkup(React.createElement(NewHome,{go(){},exercise:exercises[0],openExercise(){},startGame(){},ex:exercises,card(){return null}}))}
setActiveLanguage('ru');assert(home().includes('Начать упражнения'));assert(home().includes('Для родителей'));assert(home().includes('/logoped-u-session.png'));
setActiveLanguage('en');assert(home().includes('Start exercises'));assert(home().includes('For parents'));
setActiveLanguage('uz');assert(home().includes('Mashqlarni boshlash'));
const data={me:{role:'admin',care:true},records:[{id:'p1',kind:'student',data:{name:'Test child'}}]};setActiveLanguage('ru');const form=renderToStaticMarkup(React.createElement(CarePanel,{kind:'task',data,initialStudent:'p1',save(){},onSettings(){},onStudents(){}}));assert(form.includes('Отправить задание'));assert(/value="Yangi"[^>]*>Новое/.test(form));assert(form.includes('Test child'));
setActiveLanguage('en');assert.equal(localize('5 daqiqa'),'5 minutes');assert.equal(localize('Private parent message'),'Private parent message');
setActiveLanguage('uz');assert.equal(localize('Yangi'),'Yangi');
console.log('12 language, rendered interface and stable form-value checks passed');
const {default:Gradebook,gradeSummary}=load('app/components/Gradebook.tsx');
assert.deepEqual(JSON.parse(JSON.stringify(gradeSummary([]))),{count:0,average:'—'});
assert.equal(gradeSummary([{data:{score:5}},{data:{score:3}},{data:{score:0}}]).average,'4.0');
for(const lang of ['uz','en','ru']){setActiveLanguage(lang);const rendered=renderToStaticMarkup(React.createElement(Gradebook,{students:data.records,records:[],filter:'',onFilter(){},onAdd(){},onEdit(){}}));assert(rendered.includes('Test child'));assert(rendered.includes(localize('Baholar tabeli')));assert(rendered.includes('—'));}
setActiveLanguage('uz');
for(const kind of ['grade','note','task']){const rendered=renderToStaticMarkup(React.createElement(CarePanel,{kind,data,save(){},onSettings(){},onStudents(){}}));assert(rendered.includes('<form'));assert(rendered.includes('Test child'));assert(/<option value="" selected="">Tanlang/.test(rendered));}
const panel=fs.readFileSync('app/components/AdminPanel.tsx','utf8');assert.equal((panel.match(/<CarePanel /g)||[]).length,1);
console.log('21 gradebook, empty-state and student-selection checks passed');
const LessonComplete=load('app/components/LessonComplete.tsx').default;
for(const lang of ['uz','ru','en']){setActiveLanguage(lang);const html=renderToStaticMarkup(React.createElement(LessonComplete,{lesson:exercises[0],students:data.records,refresh(){},openHomework(){}}));assert(html.includes(localize('Darsni tugatdim')));assert(html.includes('Test child'));}
const {ChildCabinet}=load('app/components/WorkflowTools.tsx');setActiveLanguage('uz');const childHtml=renderToStaticMarkup(React.createElement(ChildCabinet,{me:{id:'s1',role:'student'},records:[],save(){},go(){}}));assert(childHtml.includes('Chat'));
console.log('7 lesson completion and child chat entry render checks passed');
const {default:StudentWorkspace,ReviewQueue}=load('app/components/StudentWorkspace.tsx');
for(const lang of ['uz','en','ru']){
 setActiveLanguage(lang);
 const hub=renderToStaticMarkup(React.createElement(StudentWorkspace,{data,save(){},go(){},initialStudent:'p1'}));
 assert(hub.includes('Test child'));assert(hub.includes(localize('Baho qo‘yish')));assert(hub.includes(localize('Hali yozuv yo‘q. Birinchi vazifani bering.')));
 const queueData={...data,records:[...data.records,{id:'done',kind:'task',student:'p1',created:'2026-10-10',data:{title:'Completed topic',status:'Bajarildi'}},{id:'todo',kind:'task',student:'p1',created:'2026-10-10',data:{title:'Unfinished topic',status:'Yangi'}}]};
 const queue=renderToStaticMarkup(React.createElement(ReviewQueue,{data:queueData,save(){}}));assert(queue.includes('Completed topic'));assert(!queue.includes('Unfinished topic'));
}
console.log('15 student workspace and review queue render checks passed');
const {default:AdminGate}=load('app/components/AdminGate.tsx');
for(const lang of ['uz','en','ru']){setActiveLanguage(lang);const setup=renderToStaticMarkup(React.createElement(AdminGate,{configured:false}));assert(setup.includes(localize('Admin kodini yarating')));assert(setup.includes('minLength="12"'));assert(!setup.includes('name="code"'));const unlock=renderToStaticMarkup(React.createElement(AdminGate,{configured:true}));assert(unlock.includes('name="code"'));assert(!unlock.includes('name="newCode"'));assert(unlock.includes(localize('Kodni unutdingizmi?')))}
console.log('18 admin setup, unlock and translation render checks passed');
