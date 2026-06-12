"""
调试脚本：检查404错误来源和登录弹窗问题
"""
from playwright.sync_api import sync_playwright
import time

BASE_URL = "http://127.0.0.1:3456"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    
    # 捕获所有请求
    failed_requests = []
    def handle_route(route, request):
        if request.url.startswith(BASE_URL):
            route.continue_()
    
    page.on("response", lambda response: 
        failed_requests.append({"url": response.url, "status": response.status}) 
        if response.status >= 400 and response.url.startswith(BASE_URL) else None
    )
    
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    print("=== 失败的请求 ===")
    for req in failed_requests:
        print(f"  {req['status']} | {req['url']}")
    
    print("\n=== 登录弹窗检查 ===")
    login_dialog = page.locator("#loginDialog").first
    print(f"loginDialog 存在: {login_dialog.count() > 0}")
    
    # 点击登录按钮
    top_auth = page.locator("#topAuthBtn").first
    print(f"topAuthBtn 存在: {top_auth.count() > 0}, 可见: {top_auth.is_visible() if top_auth.count() > 0 else False}")
    
    if top_auth.count() > 0:
        top_auth.click()
        time.sleep(1)
        
        # 检查dialog状态
        dialog = page.locator("#loginDialog").first
        print(f"点击后 dialog 可见: {dialog.is_visible() if dialog.count() > 0 else False}")
        
        # 检查内部元素
        guest_btn = page.locator("#loginGuestBtn").first
        print(f"loginGuestBtn 存在: {guest_btn.count() > 0}")
        
        # 获取dialog的HTML
        if dialog.count() > 0:
            html = dialog.evaluate("el => el.outerHTML")
            print(f"\nDialog HTML (前500字符):\n{html[:500]}")
    
    print("\n=== 检查script.js是否正确加载 ===")
    has_switchView = page.evaluate("typeof switchView === 'function'")
    print(f"switchView 函数存在: {has_switchView}")
    
    has_escapeHtml = page.evaluate("typeof escapeHtml === 'function'")
    print(f"escapeHtml 函数存在: {has_escapeHtml}")
    
    browser.close()
