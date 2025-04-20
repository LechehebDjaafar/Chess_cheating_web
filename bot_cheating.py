# app.py
from flask import Flask, render_template, request, jsonify
import requests
import chess

app = Flask(__name__)

# عنوان API الخارجي للحصول على أفضل نقلة من Stockfish
STOCKFISH_API_URL = "https://stockfish.online/api/s/v2.php"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/best_move', methods=['POST'])
def get_best_move():
    try:
        data = request.get_json()
        fen = data.get('fen')
        print(fen)
        skill_level = int(data.get('skill_level', 20))  # سيتم استخدامه لاحقًا في تعيين العمق
        
        # تعيين العمق بناءً على مستوى المهارة
        # مستويات أقل = عمق أقل
        if skill_level <= 5:
            depth = 5
        elif skill_level <= 10:
            depth = 10
        elif skill_level <= 15:
            depth = 15
        else:
            depth = 20
        
        # التحقق من صحة FEN
        try:
            chess.Board(fen)
        except ValueError:
            return jsonify({
                'error': 'وضعية FEN غير صالحة',
                'success': False
            })
        
        # إرسال طلب إلى API الخارجي
        params = {
            'fen': fen,
            'depth': depth
        }
        
        response = requests.get(STOCKFISH_API_URL, params=params)
        print("Raw API Response:", response.text)  # أضف هذه السطر
        response.raise_for_status()  # رفع استثناء في حالة فشل الطلب
        
        api_data = response.json()
        print("API Response:", api_data)  # للتتبع

        if api_data.get("success", False):
            best_move = api_data.get("bestmove", "").replace("bestmove ", "")  # إزالة "bestmove " إذا وجد
            evaluation = api_data.get("evaluation")
            mate = api_data.get("mate")  # إشارة إلى كش مات

            if mate:
                return jsonify({
                    'move': best_move,
                    'evaluation': f"كش مات في {mate} نقلات",
                    'success': True
                })
            elif best_move:
                return jsonify({
                    'move': best_move,
                    'evaluation': evaluation if evaluation else "غير متاح",
                    'success': True
                })
            else:
                return jsonify({
                    'error': 'تعذر استخراج أفضل نقلة من الاستجابة',
                    'success': False
                })
        else:
            return jsonify({
                'error': api_data.get("error", "خطأ غير محدد في API"),
                'success': False
            })
            
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': f'خطأ في الاتصال بـ API: {str(e)}',
            'success': False
        })
    except Exception as e:
        return jsonify({
            'error': f'خطأ غير متوقع: {str(e)}',
            'success': False
        })

if __name__ == '__main__':
    app.run(debug=True)