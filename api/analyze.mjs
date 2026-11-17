import {createHandler} from '../server/research-api.mjs';

// Reuse one handler per warm instance; provider credentials stay in Vercel env.
const handle=createHandler(process.env);
export default async function analyze(req,res){
  req.url='/analyze';
  return handle(req,res);
}
