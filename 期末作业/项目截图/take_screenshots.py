"""
拾寻项目预览截图生成脚本
使用 Playwright 截取关键页面截图（新版界面）
"""
from playwright.sync_api import sync_playwright
import os

BASE_URL = "https://shixun-lost-found.vercel.app"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

def take_screenshots():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        
        # 截图1：首页整体（新版卡片网格 + Inspector 面板）
        page.goto(BASE_URL)
        page.wait_for_timeout(4000)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "01_首页.png"), full_page=True)
        print("✅ 截图1: 首页")
        
        # 截图2：发布弹窗（展示北京市/朝阳区/传媒大学级联）
        page.click("text=发布")
        page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "02_发布表单.png"))
        print("✅ 截图2: 发布表单")
        
        # 关闭弹窗
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        
        # 截图3：匹配页面（环形进度条 + 维度条形图）
        page.click("text=匹配")
        page.wait_for_timeout(2500)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "03_匹配页面.png"), full_page=True)
        print("✅ 截图3: 匹配页面")
        
        # 截图4：个人中心（拾小寻 FAQ 面板）
        page.evaluate("document.querySelector('[data-view=\"profile\"]')?.click()")
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "04_个人中心.png"))
        print("✅ 截图4: 个人中心")
        
        # 截图5：通知中心
        page.evaluate("document.querySelector('#notificationBtn')?.click()")
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "05_通知中心.png"))
        print("✅ 截图5: 通知中心")
        
        # 截图6：拾小寻 FAQ 面板
        page.evaluate("document.querySelector('.mascot-avatar')?.click()")
        page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "06_拾小寻FAQ.png"))
        print("✅ 截图6: 拾小寻FAQ")
        
        # 截图7：移动端首页（模拟手机）
        mobile_page = browser.new_page(viewport={"width": 390, "height": 844})
        mobile_page.goto(BASE_URL)
        mobile_page.wait_for_timeout(4000)
        mobile_page.screenshot(path=os.path.join(OUTPUT_DIR, "07_移动端首页.png"))
        print("✅ 截图7: 移动端首页")
        
        browser.close()
        print(f"\n所有截图已保存到: {OUTPUT_DIR}")

if __name__ == "__main__":
    take_screenshots()
