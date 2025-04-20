import requests
import json

def get_best_move(fen, depth=12):
    """
    الحصول على أفضل نقلة من API Stockfish v2 لوضعية شطرنج معينة.
    
    :param fen: سلسلة نصية تمثل وضعية الشطرنج بتنسيق FEN
    :param depth: عمق البحث للمحرك (الافتراضي: 12)
    :return: أفضل نقلة والتقييم
    """
    # تحديث عنوان URL للإصدار الثاني من API
    url = "https://stockfish.online/api/s/v2.php"
    params = {
        "fen": fen,
        "depth": depth
    }
    
    try:
        # إرسال الطلب GET
        response = requests.get(url, params=params)
        
        # التحقق من نجاح الطلب
        response.raise_for_status()
        
        # طباعة الاستجابة الخام للتشخيص
        print("الاستجابة الخام:")
        print(response.text)
        
        # تحليل الاستجابة JSON
        try:
            data = response.json()
            
            # طباعة الاستجابة الكاملة للتحقق
            print("\nاستجابة API كاملة:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            # استخراج أفضل نقلة والتقييم استنادًا إلى الهيكل الجديد للإصدار v2
            if isinstance(data, dict) and "success" in data:
                if data["success"]:
                    # تحقق من هيكل البيانات لاستخراج أفضل نقلة
                    if "best_move" in data:
                        best_move = data["best_move"]
                        evaluation = data.get("evaluation", "غير متوفر")
                        return best_move, evaluation
                    elif "data" in data and isinstance(data["data"], dict) and "best_move" in data["data"]:
                        best_move = data["data"]["best_move"]
                        evaluation = data["data"].get("evaluation", "غير متوفر")
                        return best_move, evaluation
                else:
                    # إذا كان هناك خطأ محدد في الاستجابة
                    error_message = data.get("data", "خطأ غير محدد")
                    return f"خطأ: {error_message}", None
            else:
                # محاولة استخراج البيانات من هيكل غير معروف
                if "best_move" in str(data):
                    for key, value in data.items():
                        if isinstance(value, dict) and "best_move" in value:
                            return value["best_move"], value.get("evaluation", "غير متوفر")
                
                return "تعذر استخراج أفضل نقلة من الاستجابة", None
                
        except json.JSONDecodeError:
            return "تعذر تحليل استجابة JSON", None
            
    except requests.exceptions.RequestException as e:
        return f"حدث خطأ أثناء الاتصال بـ API: {e}", None
    except Exception as e:
        return f"حدث خطأ غير متوقع: {e}", None

def main():
    print("برنامج الحصول على أفضل نقلة شطرنج من API Stockfish")
    print("=" * 50)
    
    # الوضعية الافتراضية هي وضعية البداية القياسية
    default_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    
    # طلب من المستخدم إدخال FEN أو استخدام الافتراضي
    user_fen = input(f"أدخل وضعية FEN (اضغط Enter للوضعية الافتراضية):\n")
    fen = user_fen if user_fen else default_fen
    
    # طلب من المستخدم إدخال عمق البحث أو استخدام الافتراضي
    depth_input = input("أدخل عمق البحث (اضغط Enter للقيمة الافتراضية 12):\n")
    depth = int(depth_input) if depth_input.isdigit() else 12
    
    print(f"\nجاري البحث عن أفضل نقلة للوضعية:")
    print(f"FEN: {fen}")
    print(f"العمق: {depth}")
    print("-" * 50)
    
    # الحصول على أفضل نقلة
    best_move, evaluation = get_best_move(fen, depth)
    
    print("\nالنتيجة:")
    print(f"أفضل نقلة: {best_move}")
    if evaluation:
        print(f"التقييم: {evaluation}")

if __name__ == "__main__":
    main()