"""
调试脚本2：检查登录按钮点击后的行为
"""
from playwright.sync_api import sync_playwright
import time

BASE_URL = "http://127.0.0.1:3456"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    print("=== 检查登录按钮 ===")
    top_auth = page.locator("#topAuthBtn").first
    print(f"topAuthBtn 存在: {top_auth.count() > 0}")
    print(f"topAuthBtn 文本: {top_auth.text_content() if top_auth.count() > 0 else 'N/A'}")
    print(f"topAuthBtn onclick: {top_auth.evaluate('el => el.onclick?.toString()') if top_auth.count() > 0 else 'N/A'}")
    
    print("\n=== 检查loginDialog状态 ===")
    dialog = page.locator("#loginDialog").first
    print(f"loginDialog 存在: {dialog.count() > 0}")
    print(f"loginDialog open属性: {dialog.evaluate('el => el.open') if dialog.count() > 0 else 'N/A'}")
    
    print("\n=== 点击登录按钮 ===")
    if top_auth.count() > 0:
        # 使用JS点击而不是Playwright点击
        page.evaluate("document.querySelector('#topAuthBtn').click()")
        time.sleep(1)
        
        print(f"点击后 open属性: {dialog.evaluate('el => el.open') if dialog.count() > 0 else 'N/A'}")
        print(f"点击后 showModal存在: {page.evaluate('typeof document.querySelector(\"#loginDialog\").showModal')}")
        
        # 尝试直接调用showModal
        page.evaluate("document.querySelector('#loginDialog').showModal()")
        time.sleep(0.5)
        print(f"直接showModal后 open属性: {dialog.evaluate('el => el.open') if dialog.count() > 0 else 'N/A'}")
        
        # 检查guest按钮
        guest = page.locator("#loginGuestBtn").first
        print(f"loginGuestBtn 存在: {guest.count() > 0}")
        if guest.count() > 0:
            print(f"loginGuestBtn 可见: {guest.is_visible()}")
    
    browser.close()
