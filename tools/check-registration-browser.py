"""Offline functional browser verification; no real Google submissions or messages."""
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import json, mimetypes, os, shutil, re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('REGISTRATION_SCREENSHOT_DIR','/tmp/unity-registration-screenshots')); OUT.mkdir(parents=True,exist_ok=True)
CONFIG={'enabled':True,'entries':dict(re.findall(r'(eventName|date|name|experience|eventId|mode):\s*"(entry\.\d+)"',(ROOT/'registration-config.js').read_text()))}
EVENT={'id':'one','title':'Unity 品川交流会','startsAt':'2026-10-12T05:00:00Z','endsAt':None,'location':'品川','category':'交流会','url':None}
state={'events':[EVENT,dict(EVENT,id='two',startsAt='2026-11-02T06:00:00Z')],'failure':False,'ready':True,'send_failure':False,'metadata':True}
posts=[]; growth=[]
def route(r):
    u=urlsplit(r.request.url)
    if u.hostname=='nyokki519.github.io' and u.path.startswith('/Unity_S/'):
        rel=u.path.removeprefix('/Unity_S/') or 'index.html'
        if rel=='registration-config.js':
            config=dict(CONFIG,enabled=state['ready']);
            if not state['metadata']:config['entries']={key:CONFIG['entries'][key] for key in ('eventName','date','name')}
            r.fulfill(status=200,content_type='application/javascript',body='window.UnityRegistrationConfig='+json.dumps(config)+';');return
        file=ROOT/rel
        if file.is_file():r.fulfill(status=200,body=file.read_bytes(),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream');return
    if u.hostname=='unity-analytics.vercel.app':
        headers={'Access-Control-Allow-Origin':'https://nyokki519.github.io'}
        if u.path=='/api/public/growth':
            if r.request.method=='OPTIONS':r.fulfill(status=204,headers={**headers,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST'});return
            growth.append(json.loads(r.request.post_data));r.fulfill(status=202,headers=headers,json={'ok':True});return
        if state['failure']:r.fulfill(status=503,headers=headers,json={'error':'events_unavailable'});return
        r.fulfill(status=200,headers=headers,json={'version':1,'timeZone':'Asia/Tokyo','months':['2026-10','2026-11'],'events':state['events']});return
    if u.hostname=='docs.google.com':
        if r.request.method=='POST':posts.append(parse_qs(r.request.post_data or '',keep_blank_values=True))
        if state['send_failure']:r.abort('failed');return
        r.fulfill(status=200,body='simulated transport only');return
    r.abort()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    context.route('**/*',route)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.clock.install(time=__import__('datetime').datetime(2026,10,11,tzinfo=__import__('datetime').timezone.utc))
    state['events'][1]['title']='交流会 <script>unsafe</script>'
    page.goto('https://nyokki519.github.io/Unity_S/?event_id=one');page.wait_for_timeout(300)
    assert '<script>unsafe</script>' in page.locator('#event-list').inner_text()
    assert page.locator('#event-list script').count()==0
    state['events'][1]['title']=EVENT['title']
    page.goto('https://nyokki519.github.io/Unity_S/?event_id=one');page.wait_for_timeout(300)
    assert page.locator('#event-one').is_checked(), 'published event deep-link selection missing'
    assert page.locator('#event-list script').count()==0
    page.screenshot(path=str(OUT/'01-mobile-events.png'),full_page=True)
    page.locator('#to-details').click();page.locator('#name').fill('Synthetic person')
    page.locator('#name').press('Enter');page.wait_for_timeout(100)
    assert not posts and not any(g['stage']=='form_submit' for g in growth), 'implicit Enter counted as send'
    assert page.locator('input[type=email],#email').count()==0
    page.locator('#experience-first').check();assert page.locator('#first-line-guide').is_visible()
    assert '初参加/参加希望' in page.locator('#first-line-guide').inner_text()
    assert page.locator('#add-line').get_attribute('href')=='https://lin.ee/vRZi9Rf'
    page.screenshot(path=str(OUT/'08-first-time-line-guide.png'),full_page=True)
    page.locator('#review-button').click()
    assert page.locator('#review').is_visible();assert len(posts)==0
    assert '初参加/参加希望' in page.locator('#review-summary').inner_text()
    assert not any(g['stage']=='form_submit' for g in growth)
    page.screenshot(path=str(OUT/'02-mobile-review.png'),full_page=True)
    page.locator('#edit-details').click();page.locator('#experience-returning').check()
    assert not page.locator('#first-line-guide').is_visible()
    page.locator('#review-button').click();assert '初参加/参加希望' not in page.locator('#review-line-guide').inner_text()
    page.locator('#edit-details').click();page.locator('#experience-first').check();page.locator('#review-button').click();page.locator('#send-button').dblclick()
    page.wait_for_timeout(300);assert len(posts)==1
    assert sum(g['stage']=='form_submit' for g in growth)==1
    assert posts[0]['entry.232206764']==['初めて'];assert 'entry.8001' not in posts[0]
    assert page.locator('#copy-line').inner_text()=='「初参加/参加希望」をコピー'
    context.grant_permissions(['clipboard-read','clipboard-write']);page.locator('#copy-line').click();assert page.evaluate('navigator.clipboard.readText()')=='初参加/参加希望'
    assert posts[0]['entry.1834327533']==[EVENT['title']];assert posts[0]['entry.2119680669']==['2026-10-12']
    assert posts[0]['entry.1146545082']==['公開イベント']
    assert posts[0]['entry.603909823']==['one'];assert 'entry.2127795955' in posts[0]
    assert 'Google側の受付・保存はこの画面では確認できません' in page.locator('#result').inner_text()
    assert page.locator('#line-link').get_attribute('href')=='https://lin.ee/vRZi9Rf'
    assert all(set(g)=={'journeyId','source','stage'} for g in growth)
    assert all('synthetic' not in json.dumps(g) for g in growth)
    assert not page.evaluate('localStorage.length');assert 'synthetic' not in page.evaluate('JSON.stringify(sessionStorage)')
    page.screenshot(path=str(OUT/'03-mobile-result.png'),full_page=True)
    attempted=len(posts)
    page.evaluate("dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));")
    assert page.locator('#result').is_visible() and not page.locator('#review').is_visible()
    assert page.locator('#name').input_value()=='' and page.locator('#result-summary').inner_text()==''
    assert len(posts)==attempted and '再送せず' in page.locator('#result-message').inner_text()
    assert page.locator('#copy-line').inner_text()=='「初参加/参加希望」をコピー'
    state['failure']=True
    page.goto('https://nyokki519.github.io/Unity_S/');page.wait_for_timeout(300)
    assert '取得できません' in page.locator('#feed-status').inner_text()
    page.locator('#manual-toggle').check();page.locator('#eventName').fill('未掲載テスト');page.locator('#date').fill('2026-11-03')
    page.locator('#to-details').click();page.locator('#name').fill('Synthetic manual');page.locator('#experience-returning').check()
    page.locator('#review-button').click();page.screenshot(path=str(OUT/'04-mobile-manual-review.png'),full_page=True)
    state['send_failure']=True;page.locator('#send-button').click();page.wait_for_timeout(300)
    assert '送信結果を確認できません' in page.locator('#result-title').inner_text()
    assert posts[-1]['entry.1146545082']==['自由入力']
    assert posts[-1]['entry.603909823']==[''];assert posts[-1]['entry.1834327533']==['未掲載テスト']
    assert page.locator('#name').input_value()=='Synthetic manual'
    assert page.locator('#copy-line').inner_text()=='「参加希望」をコピー'
    page.locator('#copy-line').click();assert page.evaluate('navigator.clipboard.readText()')=='参加希望'
    page.screenshot(path=str(OUT/'05-mobile-network-unknown.png'),full_page=True)
    state.update(failure=False,send_failure=False,ready=False)
    page.goto('https://nyokki519.github.io/Unity_S/');page.wait_for_timeout(300)
    assert page.locator('#setup-notice').is_visible();assert page.locator('#name').is_disabled()
    assert page.locator('#native-form-link').get_attribute('href').endswith('/viewform')
    page.screenshot(path=str(OUT/'06-configuration-gate.png'),full_page=True)
    state['ready']=True
    page.goto('https://nyokki519.github.io/Unity_S/');page.wait_for_timeout(200)
    page.locator('#event-one').focus();page.keyboard.press('Space');page.locator('#to-details').focus();page.keyboard.press('Enter')
    assert page.locator('#details-title').evaluate('(e)=>e===document.activeElement')
    page.locator('#name').fill('Synthetic keyboard');page.locator('#experience-returning').focus();page.keyboard.press('Space')
    page.locator('#review-button').focus();page.keyboard.press('Enter');assert page.locator('#review').is_visible()
    page.locator('#edit-details').focus();page.keyboard.press('Enter');assert page.locator('#name').input_value()=='Synthetic keyboard'
    page.locator('#experience-first').check();assert page.locator('#first-line-guide').is_visible()
    for width in (360,390,768,1440):
        page.set_viewport_size({'width':width,'height':900});page.goto('https://nyokki519.github.io/Unity_S/');page.wait_for_timeout(200)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
        if width==1440:page.screenshot(path=str(OUT/'07-desktop-events.png'),full_page=True)
    page.locator('#event-one').check();page.locator('#to-details').click();page.locator('#name').fill('Synthetic preserved');page.locator('#experience-first').check()
    state['events']=[];page.locator('#edit-event').click();page.locator('#refresh-events').click();page.wait_for_timeout(300)
    assert page.locator('#name').input_value()=='Synthetic preserved'
    assert not page.locator('#event-one').count();page.locator('#to-details').click();assert page.locator('#error-event').inner_text()
    state['events']=[EVENT]
    page.goto('https://nyokki519.github.io/Unity_S/?event_id=one');page.wait_for_timeout(200)
    page.locator('#to-details').click();page.locator('#name').fill('Synthetic restored');page.locator('#experience-returning').check();page.locator('#review-button').click()
    page.evaluate("dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));")
    page.wait_for_timeout(300)
    assert page.locator('#event-step').is_visible() and not page.locator('#review').is_visible()
    assert page.locator('#name').input_value()==''
    state['metadata']=False
    page.goto('https://nyokki519.github.io/Unity_S/?event_id=one');page.wait_for_timeout(200)
    assert not page.locator('#setup-notice').is_visible()
    page.locator('#to-details').click();page.locator('#name').fill('Synthetic legacy');page.locator('#experience-first').check();page.locator('#review-button').click();page.locator('#send-button').click();page.wait_for_timeout(200)
    assert set(posts[-1])=={'entry.1834327533','entry.2119680669','entry.1786168698','entry.2127795955'}
    assert not errors,errors
    nojs=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});nojs.route('**/*',route)
    fallback=nojs.new_page();fallback.goto('https://nyokki519.github.io/Unity_S/');assert not fallback.locator('#form').is_visible();assert fallback.locator('noscript a[href*=viewform]').is_visible();assert '初参加/参加希望' in fallback.locator('body noscript').inner_text();nojs.close()
    browser.close()
print('PASS event/manual selection, first-time LINE guide/copy and returning unchanged, review/edit, no-PII tracking, one send, unknown outcome, configuration gate and legacy three-entry compatibility, 4 widths and refresh preservation')
