from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
old=(root/'work/index-v2-original.html').read_text(encoding='utf-8')
html, js=old.split('<script>',1)
js=js.split('</script>',1)[0]
core=js[:js.index("$$('[data-tab]')")]
core=core.replace("explode:.2", "explode:.62")
core=core.replace("function choose(id){", "function choose(id){")
core=core.replace("renderLesson();updateMetrics();}", "renderLesson();updateMetrics();if(window.lab)lab.changeMotor(id);}",1)
core=core.replace("state.playing=false;state.theta=(Number", "window.lab?.manual();state.playing=false;state.theta=(Number")
# Preserve original lessons, comparison, power experiment and waveform renderer.
wave=js[js.index('function resize('):js.index('function animate(')]
energy=js[js.index('function energy()'):js.index("$('#download').onclick")]
(root/'src/core.js').write_text(core+'\n'+wave+'\n'+energy,encoding='utf-8')
html=html.replace('</style>', '\n/* LAB_STYLES */\n</style>')
html=html.replace('让看不见的磁场，转起来。','一层层拆开，一步步看懂。')
html=html.replace('从碳刷到电子换相，从同步到转差。拆开六类电机，亲手改变频率与负载，看懂风扇为什么会转。','六类电机 · 48 个讲解步骤。沿着零件、电流、磁场和转矩，走完一台电机的工作过程。')
html=html.replace('INTERACTIVE ENGINEERING · 01','MOTOR ANATOMY / 3D LEARNING STUDIO')
html=html.replace('离线版 v2.0','离线版 v3.0')
html=html.replace('先观察 BLDC，再切换有刷直流与异步电机。注意线圈的位置、转子结构和黄色磁场指针。','从右侧第 1 步开始。点“自动讲解”连续学习，或点击任意步骤与零件自由探索。')
html=html.replace('<canvas id="scene" aria-label="可拖动旋转的三维电机示意图" tabindex="0"></canvas>', '''<canvas id="scene" aria-label="三维电机，可拖动旋转、双指缩放，或使用下方零件列表" tabindex="0"></canvas>
<div id="modelLabels" aria-hidden="true"></div><div id="sceneError" class="hide" role="alert"></div>
<div class="scene-tools"><button id="fitView" title="使全部零件进入画面">适配画面</button><button id="fullView" title="放大实验台">放大实验台 ⛶</button></div>
<div class="scene-status"><i></i><span id="sceneStatus">精细结构 / EXPLODED VIEW</span></div>
<div id="angleBadge" class="angle-badge">两极示意 · 慢动作</div>
<div class="mode-switch" role="group" aria-label="三维显示模式"><button data-mode="assembled">整体</button><button data-mode="cutaway">剖面</button><button data-mode="exploded" class="active">爆炸分解</button><button data-mode="xray">透视内部</button></div>''')
html=html.replace('<aside class="readout">','<!-- COURSE_PANEL --><aside class="readout">')
html=html.replace('<div class="controls">','<!-- PARTS_PANEL --><div class="controls">')
html=html.replace('<span>拖动旋转 · 滚轮缩放 · 空格暂停</span>','<span>拖动旋转 · 滚轮 / 双指缩放 · 点击零件</span>')
html=html.replace('value="20"></div><div class="toggles">','value="62"></div><div class="toggles">')
html=html.replace('<output id="explodeOut">20%</output>','<output id="explodeOut">62%</output>')
html=html.replace('磁场指针</label>','磁场与方向</label>')
html=html.replace('前端剖开</label>','剖切机壳</label><label><input type="checkbox" id="particles" checked>电流流动</label>')
html=html.replace('<option value="side">侧面结构</option>','<option value="side">侧面结构</option><option value="back">后端结构</option>')
html=html.replace('<div class="guide" role="status">','<div class="guide">')
html=html.replace('几何与波形用于解释原理，不是有限元仿真。','亮点表示约定电流方向；磁场线与受力箭头均为教学示意。')
html=html.replace('</main>', '''<section class="content learning-check"><div class="sectiontop"><h2>05 / 用一个问题，检查是否看懂</h2><small>随电机类型切换</small></div><div id="quiz"></div></section></main>''')
(root/'src/page.html').write_text(html+'\n<!-- LAB_SCRIPTS -->\n</body></html>',encoding='utf-8')
