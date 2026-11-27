import SoundLesson from '../../components/SoundLesson';
export default async function Sound({params}:{params:Promise<{sound:string}>}){const {sound}=await params;return <SoundLesson sound={sound}/>}
