import {json} from '../../../lib/server';
import {botUsername} from '../../../lib/telegram';
export const dynamic='force-dynamic';
export async function GET(){return json({username:await botUsername()})}
