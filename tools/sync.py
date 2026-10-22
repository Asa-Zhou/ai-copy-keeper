# 把 src/index.html 注入 Electron 桥接，生成 electron/index.html
# 用法：python tools/sync.py
import io, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_path = os.path.join(ROOT, 'src', 'index.html')
dst_path = os.path.join(ROOT, 'electron', 'index.html')

with io.open(src_path, 'r', encoding='utf-8') as f:
    html = f.read()

pairs = []

# 1. 窄屏断点：桌面窗口最小 880，双栏保持更久
pairs.append((
    u'  @media (max-width:980px){',
    u'  @media (max-width:860px){'
))

# 2. 底部说明加全局热键
pairs.append((
    u'    <span><b>复制富文本</b> → 粘到 Word / 邮件 / 腾讯文档 / 飞书 / 语雀，格式完整保留</span>\n'
    u'    <span><b>微信聊天框</b>只吃纯文本 → 请用「存为图片」或「存为 Word」发送</span>\n'
    u'    <span><b>Ctrl+Enter</b> 快速复制</span>',
    u'    <span><b>Ctrl+Alt+M</b> 全局热键：任何地方复制完按一下，剪贴板直接变富文本</span>\n'
    u'    <span><b>复制富文本</b> → 粘到 Word / 邮件 / 腾讯文档 / 飞书 / 语雀</span>\n'
    u'    <span><b>微信聊天框</b>只吃纯文本 → 用「存为图片」或「存为 Word」发送</span>\n'
    u'    <span><b>Ctrl+Enter</b> 快速复制</span>'
))

# 3. copyRich：Electron 走选区复制（原生 clipboard.write 在部分环境静默失败）
pairs.append((
    u'    var html = buildRichHtml();\n'
    u'    var plain = preview.innerText.replace(/\\n{3,}/g, \'\\n\\n\').trim();\n\n'
    u'    if(navigator.clipboard && window.ClipboardItem){',
    u'    var html = buildRichHtml(false);\n'
    u'    var plain = preview.innerText.replace(/\\n{3,}/g, \'\\n\\n\').trim();\n\n'
    u'    // 1) 选区复制：Chromium 会生成标准 CF_HTML，浏览器与 Electron 通用\n'
    u'    if(legacyCopyHtml(html)){\n'
    u'      toast(\'已复制富文本，去 Word 里 Ctrl+V 试试\');\n'
    u'      return;\n'
    u'    }\n\n'
    u'    // 2) Electron 原生剪贴板兜底\n'
    u'    if(window.appBridge){\n'
    u'      window.appBridge.copyRich(\'<!--StartFragment-->\' + html + \'<!--EndFragment-->\', plain).then(function(){\n'
    u'        toast(\'已复制富文本\');\n'
    u'      }).catch(function(e){\n'
    u'        toast(\'复制失败：\' + e.message);\n'
    u'      });\n'
    u'      return;\n'
    u'    }\n\n'
    u'    // 3) 浏览器异步剪贴板 API 兜底\n'
    u'    if(navigator.clipboard && window.ClipboardItem){'
))

# 4. ClipboardItem 的 html 补 fragment 标记
pairs.append((
    u"          'text/html': new Blob([html], { type: 'text/html' }),",
    u"          'text/html': new Blob(['<!--StartFragment-->' + html + '<!--EndFragment-->'], { type: 'text/html' }),"
))

# 5. 兜底 toast 简化
pairs.append((
    u"          toast(legacyCopyHtml(html) ? '已复制富文本' : '复制失败，请手动选中右侧内容 Ctrl+C');",
    u"          toast('复制失败，请手动选中右侧内容 Ctrl+C');"
))

# 6. （copyPlain 已统一走 copyRawText，内部自带桥接兜底，无需单独替换）

# 7. download 走原生保存对话框
pairs.append((
    u"  function download(blob, name){\n"
    u"    var a = document.createElement('a');",
    u"  function download(blob, name){\n"
    u"    if(window.appBridge){\n"
    u"      blob.arrayBuffer().then(function(buf){\n"
    u"        window.appBridge.saveFile(name, new Uint8Array(buf)).then(function(saved){\n"
    u"          if(saved) toast('已保存：' + saved);\n"
    u"          else toast('已取消保存');\n"
    u"        }).catch(function(e){ toast('保存失败：' + e.message); });\n"
    u"      });\n"
    u"      return;\n"
    u"    }\n"
    u"    var a = document.createElement('a');"
))

# 8. readClipboard 走桥接
pairs.append((
    u"  function readClipboard(){\n"
    u"    if(navigator.clipboard && navigator.clipboard.readText){",
    u"  function readClipboard(){\n"
    u"    if(window.appBridge){\n"
    u"      window.appBridge.readText().then(function(text){\n"
    u"        if(!text){ toast('剪贴板里没有文字'); return; }\n"
    u"        src.value = text;\n"
    u"        update();\n"
    u"        toast('已读取 ' + text.length + ' 个字符');\n"
    u"      });\n"
    u"      return;\n"
    u"    }\n"
    u"    if(navigator.clipboard && navigator.clipboard.readText){"
))

# 9. 全局热键入口
pairs.append((
    u"  update();\n"
    u"})();",
    u"  if(!src.value) src.value = SAMPLE;\n"
    u"  update();\n\n"
    u"  /* 桌面版：全局热键触发。主进程用 executeJavaScript(code, true) 调用，\n"
    u"     带用户手势才能让 execCommand('copy') 真正写进系统剪贴板 */\n"
    u"  window.__hotkeyTransform = function(text){\n"
    u"    try{\n"
    u"      src.value = text;\n"
    u"      update();\n"
    u"      var html = buildRichHtml(false);\n"
    u"      if(legacyCopyHtml(html)) return 'ok';\n"
    u"      var plain = preview.innerText.replace(/\\n{3,}/g, '\\n\\n').trim();\n"
    u"      if(window.appBridge){\n"
    u"        window.appBridge.copyRich('<!--StartFragment-->' + html + '<!--EndFragment-->', plain);\n"
    u"        return 'ok-ipc';\n"
    u"      }\n"
    u"      return 'fail';\n"
    u"    }catch(e){\n"
    u"      return 'error:' + (e && e.message ? e.message : e);\n"
    u"    }\n"
    u"  };\n\n"
    u"  if(window.appBridge){\n"
    u"    window.appBridge.onTransform(function(text){\n"
    u"      window.__hotkeyTransform(text);\n"
    u"    });\n"
    u"    window.appBridge.onShown(function(){ src.focus(); });\n"
    u"  }\n"
    u"})();"
))

fail = []
for i, (old, new) in enumerate(pairs, 1):
    if old not in html:
        fail.append(i)
        continue
    if html.count(old) != 1:
        fail.append('%d(count=%d)' % (i, html.count(old)))
        continue
    html = html.replace(old, new, 1)

if fail:
    print('替换失败:', fail)
    sys.exit(1)

with io.open(dst_path, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

print('已生成 electron/index.html，长度', len(html))
print('校验：桥接存在 =', 'appBridge' in html, '| 热键入口 =', '__hotkeyTransform' in html, '| 代码卡片 =', 'code-block' in html, '| 语法高亮 =', 'highlightCode' in html)
