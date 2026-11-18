import {providerConfig,requestEnvironment} from '../server/research-api.mjs';
export default function health(req,res){
  res.setHeader('Cache-Control','no-store');
  res.statusCode=200;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const provider=providerConfig(requestEnvironment(req,process.env));
  res.end(JSON.stringify({status:'ok',workflow:'paper-multiagent-v1',agents:['reader','methods','planner','reviewer'],provider:provider.provider,ai_configured:Boolean(provider.key&&provider.model),access_configured:Boolean(process.env.ANALYSIS_ACCESS_TOKEN)}));
}
