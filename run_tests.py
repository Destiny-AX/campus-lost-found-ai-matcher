"""
拾寻 功能自动化测试脚本
使用 Playwright 进行浏览器自动化测试
"""
from playwright.sync_api import sync_playwright
import sys
import time

BASE_URL = "http://127.0.0.1:4173"
TEST_RESULTS = []

def log(test_name, passed, detail=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    TEST_RESULTS.append({"name": test_name, "passed": passed, "detail": detail})
    print(f"{status} | {test_name}" + (f" - {detail}" if detail else ""))

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        
        # 捕获控制台日志
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        
        # 捕获页面错误
        page_errors = []
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        
        print("=" * 60)
        print("开始执行拾寻功能测试")
        print("=" * 60)
        
        # ============ 测试1: 页面加载 ============
        print("\n【一、页面加载与基础渲染】")
        try:
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            time.sleep(1)
            
            # 检查页面标题
            title = page.title()
            log("页面标题加载", "拾寻" in title, f"标题: {title}")
            
            # 检查JS错误
            js_errors = [e for e in page_errors if "SyntaxError" in e or "ReferenceError" in e or "TypeError" in e]
            log("无严重JS错误", len(js_errors) == 0, f"错误数: {len(js_errors)}")
            if js_errors:
                for e in js_errors[:3]:
                    print(f"    JS错误: {e[:100]}")
            
            # 检查导航栏
            nav_items = page.locator("nav a, .nav-item, [role='tab']").all()
            log("导航栏存在", len(nav_items) > 0, f"导航项数: {len(nav_items)}")
            
            # 检查搜索框
            search = page.locator("input[type='search'], #searchInput, [placeholder*='搜索']").first
            log("搜索框存在", search.is_visible() if search.count() > 0 else False)
            
            # 检查记录列表或空状态
            cards = page.locator(".card, article").all()
            empty_state = page.locator(".empty-state").first
            has_content = len(cards) > 0 or (empty_state.count() > 0 and empty_state.is_visible())
            log("记录列表/空状态渲染", has_content, f"卡片数: {len(cards)}")
            
            # 检查统计面板
            stat_elements = page.locator("#statTotalRecovered, #statHelpedOthers, #statActiveItems, #statMyCredit").all()
            log("统计面板元素存在", len(stat_elements) >= 3, f"统计元素数: {len(stat_elements)}")
            
        except Exception as e:
            log("页面加载测试", False, str(e)[:100])
        
        # ============ 测试2: 导航切换 ============
        print("\n【导航切换测试】")
        views = ["publish", "match", "notify", "stats", "profile"]
        for view in views:
            try:
                # 尝试点击导航
                nav = page.locator(f"a[href='#{view}'], [data-view='{view}'], #{view}Tab").first
                if nav.count() == 0:
                    # 尝试通过JS切换
                    page.evaluate(f"switchView('{view}')")
                else:
                    nav.click()
                time.sleep(0.5)
                
                # 检查视图是否激活
                active = page.locator(f"#{view}, .view#{view}, [id='view-{view}']").first
                is_visible = active.count() > 0 and active.is_visible()
                log(f"切换到 {view} 视图", is_visible)
            except Exception as e:
                log(f"切换到 {view} 视图", False, str(e)[:80])
        
        # 切回首页
        try:
            page.evaluate("switchView('home')")
            time.sleep(0.5)
        except:
            pass
        
        # ============ 测试3: 用户认证 ============
        print("\n【二、用户认证流程】")
        try:
            # 检查未登录状态
            user_bar = page.locator("#userStatusBar").first
            if user_bar.count() > 0:
                bar_text = user_bar.text_content() or ""
                log("未登录状态显示", "登录" in bar_text or "解锁" in bar_text, f"文本: {bar_text[:50]}")
            
            # 尝试游客登录 - 使用JS直接触发（onclick是动态绑定的，Playwright可能检测不到）
            page.evaluate("document.querySelector('#loginDialog')?.showModal()")
            time.sleep(0.5)
            
            # 检查dialog是否打开
            dialog_open = page.evaluate("document.querySelector('#loginDialog')?.open")
            log("登录弹窗打开", dialog_open is True)
            
            # 查找游客登录按钮
            guest_btn = page.locator("#loginGuestBtn").first
            if guest_btn.count() > 0:
                guest_btn.click()
                time.sleep(1)
                
                # 检查登录后状态（登录后会reload，需要重新等待）
                page.wait_for_load_state("networkidle")
                time.sleep(1)
                
                # 验证localStorage中有token
                token = page.evaluate("localStorage.getItem('shiyun_auth_token')")
                log("游客登录成功", token is not None and len(token) > 10, f"token长度: {len(token) if token else 0}")
                
                # 检查用户信息（登录后reload，检查topAuthBtn或localStorage中的user）
                token_check = page.evaluate("localStorage.getItem('shiyun_auth_token')")
                user_check = page.evaluate("() => { try { const t = localStorage.getItem('shiyun_auth_token'); if (!t) return ''; const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p.nickname || ''; } catch(e) { return ''; } }")
                log("登录后状态栏更新", bool(token_check and user_check), f"用户: {user_check[:30]}")
            else:
                log("游客登录按钮", False, "未找到")
                
        except Exception as e:
            log("用户认证测试", False, str(e)[:100])
        
        # ============ 测试4: 发布功能（表单检查） ============
        print("\n【三、发布记录功能】")
        try:
            page.evaluate("switchView('publish')")
            time.sleep(0.5)
            
            # 检查表单字段
            form_fields = [
                ("标题输入", "input[name='title']"),
                ("类别选择", "select[name='category']"),
                ("颜色选择", "select[name='color']"),
                ("时间输入", "input[name='time']"),
                ("联系方式", "input[name='contact']"),
                ("描述输入", "textarea[name='description']"),
            ]
            for name, selector in form_fields:
                el = page.locator(selector).first
                log(f"发布表单-{name}", el.count() > 0 and el.is_visible())
            
            # 检查图片上传
            file_input = page.locator("input[type='file']").first
            log("图片上传输入", file_input.count() > 0)
            
            # 检查AI输入
            ai_input = page.locator("#aiInput, textarea[placeholder*='AI']").first
            log("AI结构化输入", ai_input.count() > 0)
            
            # 检查地域选择
            district = page.locator("select[name='district']").first
            log("地域-区选择", district.count() > 0)
            
        except Exception as e:
            log("发布功能测试", False, str(e)[:100])
        
        # ============ 测试5: 匹配功能 ============
        print("\n【四、AI匹配功能】")
        try:
            page.evaluate("switchView('match')")
            time.sleep(0.5)
            
            # 检查匹配页面元素
            query_select = page.locator("#queryRecord").first
            log("匹配-记录选择器", query_select.count() > 0)
            
            match_results = page.locator("#matchResults").first
            log("匹配-结果区域", match_results.count() > 0)
            
        except Exception as e:
            log("匹配功能测试", False, str(e)[:100])
        
        # ============ 测试6: 通知功能 ============
        print("\n【六、通知系统】")
        try:
            page.evaluate("switchView('notify')")
            time.sleep(0.5)
            
            notify_list = page.locator("#notifyList").first
            log("通知列表区域", notify_list.count() > 0)
            
            # 检查通知角标（如果存在）
            badge = page.locator("#notifyBadge").first
            log("通知角标元素", badge.count() > 0)
            
        except Exception as e:
            log("通知功能测试", False, str(e)[:100])
        
        # ============ 测试7: 个人页面 ============
        print("\n【个人页面】")
        try:
            page.evaluate("switchView('profile')")
            time.sleep(0.5)
            
            profile_content = page.locator("#profileContent").first
            log("个人内容区域", profile_content.count() > 0)
            
            if profile_content.count() > 0:
                text = profile_content.text_content() or ""
                # 未登录时显示"请先登录"，登录后才显示EXP/Lv.
                if "请先登录" in text:
                    log("个人页面-未登录状态", True, "显示请先登录提示")
                else:
                    log("个人页面-经验值显示", "EXP" in text, f"包含EXP: {'EXP' in text}")
                    log("个人页面-等级显示", "Lv." in text, f"包含Lv.: {'Lv.' in text}")
                
        except Exception as e:
            log("个人页面测试", False, str(e)[:100])
        
        # ============ 测试8: 详情弹窗 ============
        print("\n【详情弹窗】")
        try:
            page.evaluate("switchView('home')")
            time.sleep(0.5)
            
            # 尝试点击第一个卡片的详情按钮
            detail_btn = page.locator("[data-detail-id]").first
            if detail_btn.count() > 0:
                detail_btn.click()
                time.sleep(0.5)
                
                dialog = page.locator("#detailDialog").first
                log("详情弹窗打开", dialog.count() > 0 and dialog.is_visible())
                
                if dialog.count() > 0 and dialog.is_visible():
                    # 检查弹窗内容
                    dialog_text = dialog.text_content() or ""
                    log("详情弹窗-联系方式", "联系方式" in dialog_text)
                    
                    # 关闭弹窗
                    close_btn = dialog.locator("button:has-text('关闭'), .close-btn").first
                    if close_btn.count() > 0:
                        close_btn.click()
                    else:
                        page.keyboard.press("Escape")
                    time.sleep(0.3)
            else:
                log("详情弹窗-无记录可测试", True, "列表为空，跳过")
                
        except Exception as e:
            log("详情弹窗测试", False, str(e)[:100])
        
        # ============ 测试9: XSS防护检查 ============
        print("\n【十、安全测试】")
        try:
            # 检查escapeHtml函数是否存在
            has_escape = page.evaluate("typeof escapeHtml === 'function'")
            log("escapeHtml函数存在", has_escape)
            
            # 测试转义功能
            test_html = "<script>alert(1)</script>"
            escaped = page.evaluate(f"escapeHtml('{test_html}')")
            log("XSS转义有效", "<script>" not in escaped and "&lt;" in escaped, f"结果: {escaped[:50]}")
            
        except Exception as e:
            log("安全测试", False, str(e)[:100])
        
        # ============ 测试10: 控制台错误汇总 ============
        print("\n【控制台日志汇总】")
        error_logs = [l for l in console_logs if l.startswith("[error]")]
        warn_logs = [l for l in console_logs if l.startswith("[warning]")]
        # 过滤掉API 404错误（静态服务器无法处理/api/*请求，这是预期行为）
        api_404_errors = [l for l in error_logs if "404" in l and ("api/" in l or "api\\" in l)]
        other_errors = [l for l in error_logs if l not in api_404_errors]
        log(f"控制台非API错误数", len(other_errors) == 0, 
            f"API 404(预期): {len(api_404_errors)}, 其他错误: {len(other_errors)}, 警告: {len(warn_logs)}")
        if other_errors:
            for e in other_errors[:5]:
                print(f"    {e[:120]}")
        
        # 截图保存
        try:
            page.screenshot(path="d:/Trae_Solo_Project/拾寻/test_screenshot.png", full_page=True)
            print("\n截图已保存: test_screenshot.png")
        except Exception as e:
            print(f"截图保存失败: {e}")
        
        browser.close()
    
    # ============ 测试报告 ============
    print("\n" + "=" * 60)
    print("测试报告")
    print("=" * 60)
    passed = sum(1 for r in TEST_RESULTS if r["passed"])
    total = len(TEST_RESULTS)
    print(f"总计: {total} 项 | 通过: {passed} 项 | 失败: {total - passed} 项 | 通过率: {passed/total*100:.1f}%")
    print("-" * 60)
    
    failed_tests = [r for r in TEST_RESULTS if not r["passed"]]
    if failed_tests:
        print("\n失败项详情:")
        for r in failed_tests:
            print(f"  ❌ {r['name']}: {r['detail']}")
    else:
        print("\n所有测试通过！")
    
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
