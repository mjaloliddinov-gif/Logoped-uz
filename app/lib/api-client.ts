/** Never parse an authentication page or proxy error as API data. */
export class ApiError extends Error {
  constructor(message:string,public code='request_failed'){super(message);this.name='ApiError'}
}
export async function readApiResponse(response:Response):Promise<any>{
  if(response.type==='opaqueredirect'||response.redirected||response.status===401)throw new ApiError('Kirish sessiyasi tugagan bo‘lishi mumkin. Hisobingizga qayta kiring.','auth_required');
  const type=response.headers.get('content-type')||'';
  if(!type.toLowerCase().includes('application/json')){
    if(response.status===403)throw new ApiError('Saytga kirish ruxsatini tekshiring yoki hisobingizga qayta kiring.','auth_required');
    if(response.status>=500)throw new ApiError('Server vaqtincha javob bermayapti. Birozdan keyin qayta urinib ko‘ring.','server_error');
    throw new ApiError('Ma’lumot o‘rniga boshqa sahifa ochildi. Hisobga qayta kiring yoki sahifani yangilang.','unexpected_response');
  }
  let data:any;try{data=await response.json()}catch{throw new ApiError('Server javobini o‘qib bo‘lmadi. Qayta urinib ko‘ring.','invalid_response')}
  if(!response.ok)throw new ApiError(typeof data?.error==='string'?data.error:'So‘rov bajarilmadi. Qayta urinib ko‘ring.',response.status===423&&data?.code==='admin_locked'?'admin_locked':response.status===403?'forbidden':'request_failed');
  if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError('Server javobi kutilgan shaklda emas. Sahifani yangilang.','invalid_response');
  return data;
}
export async function apiFetch(url:string,options:RequestInit={}):Promise<any>{
  const headers=new Headers(options.headers);headers.set('Accept','application/json');
  let response:Response;try{response=await fetch(url,{...options,headers,credentials:'same-origin',redirect:'manual',cache:'no-store'})}catch{throw new ApiError('Serverga ulanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.','network')}
  return readApiResponse(response);
}
