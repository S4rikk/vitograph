import json
import os

locales = {
    "ru": {
        "whereAreCalories": "Где калории?",
        "caloriesModalTitle": "Почему VitoGraph не считает калории?",
        "caloriesModalP1": "Мы отказались от классического подсчёта, так как он математически неточен. Вместо этого мы анализируем гликемический индекс и реальный метаболический отклик вашего организма.",
        "caloriesModalP2": "Исследования Гарварда (Р. Рэнгем) доказали: погрешность этикеток и скрытые затраты тела на переваривание дают ошибку до 20% на каждый продукт. В течение дня эта погрешность стремительно накапливается (для 5 продуктов в день суммарное искажение может превосходить 100% от вашего целевого дефицита). При этом вы не будете знать, пойдут эти калории в энергию или останутся лишним грузом в вашем теле. В таких условиях опираться на подсчёт калорий бессмысленно и опасно.",
        "caloriesModalP3Title": "Для тех, кто всё же хочет отслеживать калории:",
        "caloriesModalP3": "Вы можете попросить ассистента в чате создать цель для их отслеживания. В этот момент система формирует персонального ИИ-специалиста, адаптированного именно под вашу ситуацию. В таком режиме ассистент будет более внимательно, детально и качественно помогать вам контролировать баланс потребления и расхода ресурсов.",
        "caloriesModalDisclaimer": "VitoGraph фокусируется на качестве питания и метаболическом отклике — это даёт более точную и практичную картину, чем простой подсчёт калорий."
    },
    "en": {
        "whereAreCalories": "Where are the calories?",
        "caloriesModalTitle": "Why VitoGraph doesn't count calories?",
        "caloriesModalP1": "We have abandoned classical calorie counting as it is mathematically inaccurate. Instead, we analyze the glycemic index and your body's real metabolic response.",
        "caloriesModalP2": "Harvard research (R. Wrangham) has proven: label inaccuracies and the body's hidden costs of digestion result in up to a 20% error per product. Over the course of a day, this error accumulates rapidly (for 5 products a day, the total distortion can exceed 100% of your target deficit). At the same time, you won't know if these calories will go into energy or remain as dead weight in your body. Under these conditions, relying on calorie counting is meaningless and dangerous.",
        "caloriesModalP3Title": "For those who still want to track calories:",
        "caloriesModalP3": "You can ask the assistant in the chat to create a goal for tracking them. At this moment, the system forms a personalized AI specialist tailored specifically to your situation. In this mode, the assistant will more carefully, thoroughly, and qualitatively help you control the balance of resource consumption and expenditure.",
        "caloriesModalDisclaimer": "VitoGraph focuses on food quality and metabolic response — this provides a more accurate and practical picture than simple calorie counting."
    },
    "es": {
        "whereAreCalories": "¿Dónde están las calorías?",
        "caloriesModalTitle": "¿Por qué VitoGraph no cuenta calorías?",
        "caloriesModalP1": "Hemos abandonado el conteo clásico de calorías porque es matemáticamente inexacto. En su lugar, analizamos el índice glucémico y la respuesta metabólica real de su cuerpo.",
        "caloriesModalP2": "Investigaciones de Harvard (R. Wrangham) han demostrado: las inexactitudes en las etiquetas y los costos ocultos de digestión del cuerpo resultan en hasta un 20% de error por producto. A lo largo del día, este error se acumula rápidamente (para 5 productos al día, la distorsión total puede superar el 100% de su déficit objetivo). Al mismo tiempo, no sabrá si estas calorías se convertirán en energía o se quedarán como peso muerto en su cuerpo. Bajo estas condiciones, depender del conteo de calorías no tiene sentido y es peligroso.",
        "caloriesModalP3Title": "Para aquellos que aún desean registrar calorías:",
        "caloriesModalP3": "Puede pedirle al asistente en el chat que cree un objetivo para registrarlas. En este momento, el sistema forma un especialista en IA personalizado adaptado específicamente a su situación. En este modo, el asistente le ayudará de manera más cuidadosa, detallada y cualitativa a controlar el equilibrio de consumo y gasto de recursos.",
        "caloriesModalDisclaimer": "VitoGraph se enfoca en la calidad de los alimentos y la respuesta metabólica; esto proporciona una imagen más precisa y práctica que el simple conteo de calorías."
    },
    "fr": {
        "whereAreCalories": "Où sont les calories ?",
        "caloriesModalTitle": "Pourquoi VitoGraph ne compte pas les calories ?",
        "caloriesModalP1": "Nous avons abandonné le comptage classique des calories car il est mathématiquement inexact. Au lieu de cela, nous analysons l'index glycémique et la réponse métabolique réelle de votre corps.",
        "caloriesModalP2": "Les recherches de Harvard (R. Wrangham) l'ont prouvé : les inexactitudes des étiquettes et les coûts cachés de la digestion pour le corps entraînent une erreur allant jusqu'à 20 % par produit. Au cours d'une journée, cette erreur s'accumule rapidement (pour 5 produits par jour, la distorsion totale peut dépasser 100 % de votre déficit cible). De plus, vous ne saurez pas si ces calories se transformeront en énergie ou resteront stockées dans votre corps. Dans ces conditions, se fier au comptage des calories est dénué de sens et dangereux.",
        "caloriesModalP3Title": "Pour ceux qui souhaitent tout de même suivre les calories :",
        "caloriesModalP3": "Vous pouvez demander à l'assistant dans le chat de créer un objectif pour les suivre. À ce moment-là, le système forme un spécialiste en IA personnalisé, adapté spécifiquement à votre situation. Dans ce mode, l'assistant vous aidera plus attentivement, en détail et qualitativement à contrôler l'équilibre de la consommation et de la dépense des ressources.",
        "caloriesModalDisclaimer": "VitoGraph se concentre sur la qualité des aliments et la réponse métabolique — cela offre une image plus précise et pratique que le simple comptage des calories."
    },
    "de": {
        "whereAreCalories": "Wo sind die Kalorien?",
        "caloriesModalTitle": "Warum VitoGraph keine Kalorien zählt?",
        "caloriesModalP1": "Wir haben das klassische Kalorienzählen aufgegeben, da es mathematisch ungenau ist. Stattdessen analysieren wir den glykämischen Index und die tatsächliche metabolische Reaktion Ihres Körpers.",
        "caloriesModalP2": "Forschungen aus Harvard (R. Wrangham) haben bewiesen: Ungenauigkeiten bei Etiketten und die verborgenen Verdauungskosten des Körpers führen zu einem Fehler von bis zu 20 % pro Produkt. Im Laufe eines Tages summiert sich dieser Fehler schnell (bei 5 Produkten am Tag kann die Gesamtverzerrung 100 % Ihres angestrebten Defizits überschreiten). Gleichzeitig wissen Sie nicht, ob diese Kalorien in Energie umgewandelt werden oder als unnötiges Gewicht in Ihrem Körper verbleiben. Unter diesen Bedingungen ist das Verlassen auf Kalorienzählen sinnlos und gefährlich.",
        "caloriesModalP3Title": "Für diejenigen, die Kalorien dennoch verfolgen möchten:",
        "caloriesModalP3": "Sie können den Assistenten im Chat bitten, ein Ziel für die Verfolgung zu erstellen. In diesem Moment bildet das System einen personalisierten KI-Spezialisten, der speziell auf Ihre Situation zugeschnitten ist. In diesem Modus hilft Ihnen der Assistent sorgfältiger, detaillierter und qualitativer bei der Kontrolle des Gleichgewichts von Ressourcenverbrauch und -ausgabe.",
        "caloriesModalDisclaimer": "VitoGraph konzentriert sich auf die Lebensmittelqualität und die metabolische Reaktion — dies liefert ein genaueres und praktischeres Bild als einfaches Kalorienzählen."
    },
    "pt": {
        "whereAreCalories": "Onde estão as calorias?",
        "caloriesModalTitle": "Por que o VitoGraph não conta calorias?",
        "caloriesModalP1": "Abandonamos a contagem clássica de calorias porque é matematicamente imprecisa. Em vez disso, analisamos o índice glicêmico e a resposta metabólica real do seu corpo.",
        "caloriesModalP2": "Pesquisas de Harvard (R. Wrangham) comprovaram: imprecisões nos rótulos e os custos ocultos da digestão pelo corpo resultam em até 20% de erro por produto. Ao longo do dia, esse erro se acumula rapidamente (para 5 produtos por dia, a distorção total pode exceder 100% do seu déficit alvo). Ao mesmo tempo, você não saberá se essas calorias se transformarão em energia ou permanecerão como peso morto em seu corpo. Nessas condições, confiar na contagem de calorias é inútil e perigoso.",
        "caloriesModalP3Title": "Para aqueles que ainda desejam monitorar as calorias:",
        "caloriesModalP3": "Você pode pedir ao assistente no chat para criar um objetivo para acompanhá-las. Nesse momento, o sistema forma um especialista em IA personalizado, adaptado especificamente à sua situação. Neste modo, o assistente o ajudará de forma mais atenta, detalhada e qualitativa a controlar o equilíbrio de consumo e gasto de recursos.",
        "caloriesModalDisclaimer": "O VitoGraph foca na qualidade dos alimentos e na resposta metabólica — isso fornece uma imagem mais precisa e prática do que a simples contagem de calorias."
    },
    "zh": {
        "whereAreCalories": "卡路里在哪里？",
        "caloriesModalTitle": "为什么VitoGraph不计算卡路里？",
        "caloriesModalP1": "我们放弃了经典的卡路里计算，因为它在数学上是不准确的。相反，我们分析血糖生成指数和您身体的真实代谢反应。",
        "caloriesModalP2": "哈佛大学的研究（R. Wrangham）已经证明：标签的不准确性和身体消化的隐藏成本会导致每个产品高达20%的误差。在一天中，这种误差会迅速累积（如果一天吃5种产品，总偏差可能超过目标缺口的100%）。同时，您也不知道这些卡路里是会转化为能量还是作为负担留在体内。在这些条件下，依赖卡路里计算是毫无意义且危险的。",
        "caloriesModalP3Title": "对于那些仍然想要追踪卡路里的人：",
        "caloriesModalP3": "您可以在聊天中让助手创建一个追踪卡路里的目标。此时，系统会专门针对您的情况生成一个个性化的AI专家。在这种模式下，助手将更细致、更全面、更高质量地帮助您控制资源的消耗和支出平衡。",
        "caloriesModalDisclaimer": "VitoGraph关注食物质量和代谢反应——这比简单的卡路里计算提供了更准确、更实用的图像。"
    },
    "ja": {
        "whereAreCalories": "カロリーはどこ？",
        "caloriesModalTitle": "なぜVitoGraphはカロリーを計算しないのですか？",
        "caloriesModalP1": "古典的なカロリー計算は数学的に不正確であるため、採用していません。代わりに、グリセミック指数とあなたの体の実際の代謝反応を分析します。",
        "caloriesModalP2": "ハーバード大学の研究（R.ランガム）により、ラベルの不正確さと消化による体の隠れたコストが、製品ごとに最大20％の誤差を生むことが証明されています。1日を通してこの誤差は急速に蓄積します（1日に5つの製品を摂取した場合、総歪みは目標とするカロリー不足分の100％を超える可能性があります）。同時に、これらのカロリーがエネルギーになるのか、それとも体内に蓄積されるのかを知ることはできません。このような状況下でカロリー計算に頼ることは無意味であり、危険です。",
        "caloriesModalP3Title": "それでもカロリーを追跡したい方へ：",
        "caloriesModalP3": "チャットでアシスタントに目標の作成を依頼することができます。この時、システムはあなたの状況に特化したパーソナライズされたAIスペシャリストを形成します。このモードでは、アシスタントはリソースの消費と支出のバランスを制御するために、より慎重かつ詳細で質的に役立ちます。",
        "caloriesModalDisclaimer": "VitoGraphは食品の品質と代謝反応に焦点を当てています。これは単純なカロリー計算よりも正確で実用的な図を提供します。"
    },
    "ko": {
        "whereAreCalories": "칼로리는 어디 있나요?",
        "caloriesModalTitle": "왜 VitoGraph는 칼로리를 계산하지 않나요?",
        "caloriesModalP1": "우리는 고전적인 칼로리 계산이 수학적으로 부정확하기 때문에 이를 포기했습니다. 대신 혈당 지수와 신체의 실제 대사 반응을 분석합니다.",
        "caloriesModalP2": "하버드 대학의 연구(R. Wrangham)에 따르면 제품 라벨의 부정확성과 신체의 숨겨진 소화 비용으로 인해 제품당 최대 20%의 오차가 발생합니다. 하루 동안 이 오차는 빠르게 누적됩니다(하루에 5개 제품의 경우 총 왜곡이 목표 부족량의 100%를 초과할 수 있습니다). 동시에 이 칼로리가 에너지가 될지 아니면 체내에 불필요한 무게로 남을지 알 수 없습니다. 이러한 조건에서 칼로리 계산에 의존하는 것은 무의미하며 위험합니다.",
        "caloriesModalP3Title": "여전히 칼로리를 추적하고 싶은 분들을 위해:",
        "caloriesModalP3": "채팅에서 어시스턴트에게 추적 목표를 생성해달라고 요청할 수 있습니다. 이 순간 시스템은 귀하의 상황에 특별히 맞춤화된 개인 AI 전문가를 형성합니다. 이 모드에서 어시스턴트는 리소스 소비와 지출의 균형을 제어하는 데 더 신중하고 세부적이며 양질의 도움을 줄 것입니다.",
        "caloriesModalDisclaimer": "VitoGraph는 식품의 품질과 대사 반응에 중점을 둡니다. 이는 단순한 칼로리 계산보다 더 정확하고 실용적인 그림을 제공합니다."
    },
    "tr": {
        "whereAreCalories": "Kaloriler nerede?",
        "caloriesModalTitle": "VitoGraph neden kalori saymaz?",
        "caloriesModalP1": "Matematiksel olarak yanlış olduğu için klasik kalori sayımını terk ettik. Bunun yerine, glisemik indeksi ve vücudunuzun gerçek metabolik tepkisini analiz ediyoruz.",
        "caloriesModalP2": "Harvard araştırmaları (R. Wrangham) şunu kanıtlamıştır: etiketlerdeki yanlışlıklar ve vücudun gizli sindirim maliyetleri, ürün başına %20'ye varan bir hataya neden olur. Gün boyunca bu hata hızla birikir (günde 5 ürün için toplam sapma hedef açığınızın %100'ünü aşabilir). Aynı zamanda, bu kalorilerin enerjiye dönüşüp dönüşmeyeceğini veya vücudunuzda ölü ağırlık olarak kalıp kalmayacağını bilemezsiniz. Bu koşullar altında kalori sayımına güvenmek anlamsız ve tehlikelidir.",
        "caloriesModalP3Title": "Yine de kalori takibi yapmak isteyenler için:",
        "caloriesModalP3": "Sohbette asistandan bunları takip etmek için bir hedef oluşturmasını isteyebilirsiniz. Bu noktada sistem, durumunuza özel olarak tasarlanmış kişiselleştirilmiş bir yapay zeka uzmanı oluşturur. Bu modda asistan, kaynak tüketimi ve harcama dengesini kontrol etmenize daha dikkatli, ayrıntılı ve nitelikli bir şekilde yardımcı olacaktır.",
        "caloriesModalDisclaimer": "VitoGraph, gıda kalitesine ve metabolik tepkiye odaklanır — bu, basit kalori sayımından daha doğru ve pratik bir tablo sunar."
    },
    "ar": {
        "whereAreCalories": "أين السعرات الحرارية؟",
        "caloriesModalTitle": "لماذا لا يقوم VitoGraph بحساب السعرات الحرارية؟",
        "caloriesModalP1": "لقد تخلينا عن حساب السعرات الحرارية الكلاسيكي لأنه غير دقيق رياضيًا. بدلاً من ذلك، نقوم بتحليل مؤشر نسبة السكر في الدم والاستجابة الأيضية الحقيقية لجسمك.",
        "caloriesModalP2": "أثبتت أبحاث جامعة هارفارد (آر. رانجهام) أن عدم دقة الملصقات وتكاليف الهضم الخفية للجسم تؤدي إلى خطأ يصل إلى 20٪ لكل منتج. على مدار اليوم، يتراكم هذا الخطأ بسرعة (بالنسبة لـ 5 منتجات يوميًا، يمكن أن يتجاوز التشويه الإجمالي 100٪ من العجز المستهدف). في الوقت نفسه، لن تعرف ما إذا كانت هذه السعرات الحرارية ستتحول إلى طاقة أو ستبقى كوزن زائد في جسمك. في ظل هذه الظروف، الاعتماد على حساب السعرات الحرارية لا معنى له وخطير.",
        "caloriesModalP3Title": "لأولئك الذين لا يزالون يرغبون في تتبع السعرات الحرارية:",
        "caloriesModalP3": "يمكنك أن تطلب من المساعد في الدردشة إنشاء هدف لتتبعها. في هذه اللحظة، يشكل النظام متخصصًا مخصصًا للذكاء الاصطناعي مصممًا خصيصًا لحالتك. في هذا الوضع، سيساعدك المساعد بعناية وتفصيل وجودة أعلى للتحكم في توازن استهلاك الموارد وإنفاقها.",
        "caloriesModalDisclaimer": "يركز VitoGraph على جودة الطعام والاستجابة الأيضية - وهذا يوفر صورة أكثر دقة وعملية من حساب السعرات الحرارية البسيط."
    }
}

directory = r"c:\project\VITOGRAPH\apps\web\src\i18n\messages"

for locale, content in locales.items():
    file_path = os.path.join(directory, f"{locale}.json")
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if "diary" in data and "glycemicSurf" in data["diary"]:
            data["diary"]["glycemicSurf"].update(content)
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Updated {locale}.json")
    else:
        print(f"File {locale}.json not found.")
