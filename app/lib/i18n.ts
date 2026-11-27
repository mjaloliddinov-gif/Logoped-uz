import dictionary from './locales/interface.json';
export type Language='uz'|'en'|'ru';
let activeLanguage:Language='uz';
export function setActiveLanguage(language:Language){activeLanguage=language}
export function getActiveLanguage(){return activeLanguage}
export function getLocaleTag(){return activeLanguage==='ru'?'ru-RU':activeLanguage==='en'?'en-GB':'uz-UZ'}
export function localize(value:any):any{
 if(activeLanguage==='uz')return value;
 if(Array.isArray(value))return value.map(localize);
 if(typeof value!=='string')return value;
 const key=value.trim(),entry=(dictionary as Record<string,{en:string;ru:string}>)[key];
 if(entry)return value.replace(key,entry[activeLanguage]);
 // Combine translated labels without changing stored values or phonetic examples.
 if(value.includes(' · '))return value.split(' · ').map(localize).join(' · ');
 const suffixes:Record<string,[string,string]>={' daqiqa':[' minutes',' минут'],' yosh':[' years',' лет'],' ta mashq topildi':[' exercises found',' упражнений найдено'],' / 5 ball':[' / 5 points',' / 5 баллов'],' ball, jami 5':[' points out of 5',' баллов из 5'],' ta o‘qilmagan xabar':[' unread messages',' непрочитанных сообщений']};
 for(const [suffix,pair] of Object.entries(suffixes)){if(value.endsWith(suffix)&&/^\d+$/.test(value.slice(0,-suffix.length)))return value.slice(0,-suffix.length)+pair[activeLanguage==='en'?0:1]}
 const joined=key.match(/^(.*) (qo‘shish|saqlandi)$/);if(joined&&(dictionary as any)[joined[1]])return activeLanguage==='en'?(joined[2]==='qo‘shish'?'Add '+localize(joined[1]):localize(joined[1])+' saved'):(joined[2]==='qo‘shish'?'Добавить: '+localize(joined[1]):localize(joined[1])+' сохранено');
 return value;
}
