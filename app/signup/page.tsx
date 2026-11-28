import {redirect} from 'next/navigation';
// Registration happens in the Telegram bot; the site only signs people in.
export default function Signup(){redirect('/login')}
