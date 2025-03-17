addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const githubBaseUrl = 'https://raw.githubusercontent.com/A2kk-Server/A2kk-Launcher-Monorepo';
  
  const pathParts = url.pathname.split('/');
  const releaseType = pathParts[1];
  
  // 선택지에 따라 다른 게임 버전 사용
  if (releaseType === 'latest' || releaseType === 'prerelease') {
    const gameVersion = releaseType === 'latest' ? 'v0.0.4' : 'v0.0.5'; // latest와 prerelease의 버전 구분
    pathParts[1] = `Release/${gameVersion}`;
    const newPath = pathParts.slice(1).join('/');
    
    // latest는 master 브랜치, prerelease는 prerelease 태그 사용
    const branch = releaseType === 'latest' ? 'master' : 'prerelease';
    const redirectUrl = `${githubBaseUrl}/${branch}/${newPath}`;
    
    return Response.redirect(redirectUrl, 301);
  }
  
  return new Response('Not Found', { status: 404 });
}
