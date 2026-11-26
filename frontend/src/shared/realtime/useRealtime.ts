import {useEffect,useState} from 'react';
/** App supplies credentials from memory; shared transport never owns auth state. */
export function useRealtime(userId:string|undefined,accessToken:()=>Promise<string>) {
  const [connected,setConnected]=useState(false);
  useEffect(()=>{if(!userId)return;let active=true;let socket:WebSocket|undefined;let reconnect:ReturnType<typeof setTimeout>|undefined;let renewal:number|undefined;let delay=500;
    const authenticate=async()=>{try{const token=await accessToken();if(active&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'authenticate',accessToken:token}));}catch{socket?.close();}};
    const connect=()=>{if(!active)return;socket=new WebSocket(`${window.location.protocol==='https:'?'wss:':'ws:'}//${window.location.host}/ws/work`);socket.onopen=()=>{void authenticate();renewal=window.setInterval(()=>void authenticate(),60000);};socket.onmessage=event=>{try{const message=JSON.parse(String(event.data)) as {type?:string};if(message.type==='authenticated'){setConnected(true);delay=500;}if(message.type==='sync')window.dispatchEvent(new Event('tasknest:sync'));}catch{/* Ignore unsupported frames. */}};socket.onclose=()=>{if(renewal)clearInterval(renewal);if(active){setConnected(false);reconnect=setTimeout(connect,delay);delay=Math.min(delay*2,15000);}};socket.onerror=()=>socket?.close();};connect();
    return()=>{active=false;if(reconnect)clearTimeout(reconnect);if(renewal)clearInterval(renewal);socket?.close();};
  },[userId,accessToken]);
  return connected;
}
