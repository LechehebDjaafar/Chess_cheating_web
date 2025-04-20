let board = null;
let game = new Chess();
let engineEnabled = false;
let moveHistory = [];
let playerColor = 'both'; // 'white', 'black', or 'both'
let showLegalMoves = true;
let legalSquares = {};
let arrowLayer = null;
let squareSize = 60; // سنحسب هذه القيمة لاحقًا بشكل ديناميكي

// تهيئة اللوحة
function initializeBoard() {
    const config = {
        draggable: true,
        position: 'start',
        pieceTheme: 'static/img/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare,
        showNotation: true
    };
    
    // تدمير اللوحة الحالية إذا كانت موجودة
    if (board) {
        board.destroy();
    }
    
    board = Chessboard('board', config);
    
    // إنشاء طبقة السهم
    createArrowLayer();
    
    // حساب حجم المربع
    calculateSquareSize();
    
    updateStatus();
    updatePGN();
    updatePlayerInfo();
    
    // تطبيق التأثيرات المرئية
    applyActivePlayerHighlight();
    
    // التوافقية مع الهواتف
    $(window).resize(function() {
        board.resize();
        calculateSquareSize();
        removeArrow(); // إزالة السهم عند تغيير الحجم
    });
}

// إنشاء طبقة للسهم
function createArrowLayer() {
    // إزالة الطبقة القديمة إذا كانت موجودة
    if ($('.arrow-container').length) {
        $('.arrow-container').remove();
    }
    
    // إنشاء طبقة جديدة
    arrowLayer = $('<div>').addClass('arrow-container');
    $('#board').append(arrowLayer);
}

// حساب حجم المربع للاستخدام في رسم السهم
function calculateSquareSize() {
    squareSize = $('#board').width() / 8;
}

// التحقق مما إذا كان المستخدم يستطيع تحريك القطعة
function onDragStart(source, piece) {
    // إزالة السهم عند بدء التحريك
    removeArrow();
    
    // في وضع اللعب بكلا اللونين، يستطيع اللاعب تحريك كل القطع
    if (playerColor === 'both') {
        return !game.game_over() && piece.search(/^[wb]/) !== -1;
    }
    
    // في وضع اللعب بلون واحد، يتحقق من اللون
    const pieceColor = piece.charAt(0);
    const isPlayerTurn = game.turn() === 'w' ? playerColor === 'white' : playerColor === 'black';
    
    return !game.game_over() && isPlayerTurn &&
        ((pieceColor === 'w' && playerColor === 'white') || 
         (pieceColor === 'b' && playerColor === 'black'));
}

// عند إفلات القطعة بعد السحب
function onDrop(source, target) {
    // حذف التظليل
    removeHighlights();
    
    // معرفة ما إذا كانت النقلة قانونية
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // دائماً ترقية إلى الملكة
    });
    
    // إذا كانت النقلة غير قانونية
    if (move === null) return 'snapback';
    
    // تسجيل النقلة في التاريخ
    moveHistory.push({
        fen: game.fen(),
        move: `${source}-${target}`
    });
    
    updateStatus();
    updatePGN();
    applyActivePlayerHighlight();
    
    // إذا كان اللاعب يلعب بلون محدد والمحرك مفعل، تأتي نقلة الخصم تلقائياً
    if (playerColor !== 'both' && engineEnabled) {
        makeComputerMove();
    } else if (playerColor !== 'both' && !engineEnabled) {
        // إذا كان اللاعب يلعب ضد الكمبيوتر (وليس مع المحرك مفعل)
        setTimeout(makeComputerMove, 500);
    }
    
    // إذا كان المحرك مفعل، احصل على أفضل نقلة
    if (engineEnabled) {
        getBestMove();
    }
}

// بعد انتهاء حركة القطعة
function onSnapEnd() {
    board.position(game.fen());
}

// عند تمرير المؤشر على مربع
function onMouseoverSquare(square, piece) {
    if (!showLegalMoves) return;
    
    // الحصول على النقلات القانونية لهذا المربع
    const moves = game.moves({
        square: square,
        verbose: true
    });
    
    // إذا لم يكن هناك نقلات قانونية لهذا المربع
    if (moves.length === 0) return;
    
    // تظليل المربع الذي تم تمرير المؤشر عليه
    addHighlight(square);
    
    // تظليل النقلات القانونية
    for (let i = 0; i < moves.length; i++) {
        addHighlight(moves[i].to);
    }
}

// عند خروج المؤشر من المربع
function onMouseoutSquare() {
    removeHighlights();
}

// إضافة تظليل للمربع
function addHighlight(square) {
    const $square = $('#board .square-' + square);
    const background = $square.hasClass('black-3c85d') ? 'highlight-black' : 'highlight-white';
    $square.addClass(background);
    legalSquares[square] = background;
}

// إزالة كل التظليلات
function removeHighlights() {
    $('#board .square-55d63').removeClass('highlight-white highlight-black');
    legalSquares = {};
}

// إظهار سهم يمثل أفضل نقلة
function showMoveArrow(from, to) {
    // إزالة السهم القديم أولاً
    removeArrow();
    
    // التحقق من وجود from و to
    if (!from || !to) return;
    
    const fromSquare = $(`#board .square-${from}`);
    const toSquare = $(`#board .square-${to}`);
    
    if (fromSquare.length === 0 || toSquare.length === 0) return;
    
    // الحصول على مواقع المربعات
    const fromOffset = fromSquare.offset();
    const toOffset = toSquare.offset();
    const boardOffset = $('#board').offset();
    
    // حساب الإحداثيات النسبية للمربعات بالنسبة للوحة
    const fromX = fromOffset.left - boardOffset.left + squareSize / 2;
    const fromY = fromOffset.top - boardOffset.top + squareSize / 2;
    const toX = toOffset.left - boardOffset.left + squareSize / 2;
    const toY = toOffset.top - boardOffset.top + squareSize / 2;
    
    // إنشاء نقطة البداية
    const startDot = $('<div>').addClass('move-start-dot');
    startDot.css({
        left: fromX - 10,
        top: fromY - 10
    });
    
    // إنشاء نقطة النهاية
    const endDot = $('<div>').addClass('move-end-dot');
    endDot.css({
        left: toX - 10,
        top: toY - 10
    });
    
    // حساب زاوية السهم وطوله
    const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
    const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2)) - 20;
    
    // إنشاء السهم
    const arrow = $('<div>').addClass('move-arrow');
    arrow.css({
        left: fromX,
        top: fromY,
        width: length,
        transform: `rotate(${angle}deg)`
    });
    
    // إضافة العناصر إلى طبقة السهم
    arrowLayer.append(startDot).append(arrow);
    
    // تطبيق تأثير الظهور
    startDot.hide().fadeIn(300);
    arrow.hide().fadeIn(300);
}

// إزالة السهم
function removeArrow() {
    arrowLayer.empty();
}

// تطبيق التظليل للاعب النشط
function applyActivePlayerHighlight() {
    $('.player-info').removeClass('active');
    
    if (game.game_over()) return;
    
    if (game.turn() === 'w') {
        $('#whitePlayer').parent().addClass('active');
    } else {
        $('#blackPlayer').parent().addClass('active');
    }
}

// تحديث حالة اللعبة
function updateStatus() {
    let status = '';
    
    // التحقق من انتهاء اللعبة
    if (game.in_checkmate()) {
        status = game.turn() === 'w' ? 'انتهت اللعبة، فاز الأسود!' : 'انتهت اللعبة، فاز الأبيض!';
    } else if (game.in_draw()) {
        status = 'انتهت اللعبة، تعادل!';
    } else {
        // من دور من يلعب
        status = game.turn() === 'w' ? 'دور الأبيض للعب' : 'دور الأسود للعب';
        
        // التحقق من وضع الكش
        if (game.in_check()) {
            status += ' - الملك في وضع كش!';
        }
    }
    
    $('#gameStatus').text(status);
    
    // تفعيل زر المحرك إذا كانت اللعبة مستمرة
    $('#toggleEngineBtn').prop('disabled', game.game_over());
}

// تحديث تدوين اللعبة (PGN)
function updatePGN() {
    const pgn = game.pgn();
    const formattedPgn = pgn.replace(/(\d+\.)/g, '<br>$1').substring(4);
    $('#pgn').html(formattedPgn || 'لا توجد نقلات حتى الآن');
}

// تحديث معلومات اللاعبين
function updatePlayerInfo() {
    if (playerColor === 'white') {
        $('#whitePlayer').text('الأبيض: أنت');
        $('#blackPlayer').text('الأسود: الكمبيوتر');
    } else if (playerColor === 'black') {
        $('#whitePlayer').text('الأبيض: الكمبيوتر');
        $('#blackPlayer').text('الأسود: أنت');
    } else {
        $('#whitePlayer').text('الأبيض: أنت');
        $('#blackPlayer').text('الأسود: أنت');
    }
}

// نقلة الكمبيوتر
function makeComputerMove() {
    // التحقق مما إذا كانت اللعبة انتهت
    if (game.game_over()) return;
    
    const currentTurn = game.turn();
    const computerColor = playerColor === 'white' ? 'b' : 'w';
    
    // التحقق مما إذا كان دور الكمبيوتر
    if (currentTurn !== computerColor) return;
    
    // عرض مؤشر التحميل
    $('#loadingIndicator').show();
    
    // الحصول على أفضل نقلة من المحرك
    $.ajax({
        url: '/best_move',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ 
            fen: game.fen(),
            skill_level: $('#skillLevel').val()
        }),
        success: function(data) {
            // إخفاء مؤشر التحميل
            $('#loadingIndicator').hide();
            
            if (data.success) {
                const move = data.move;
                const from = move.substring(0, 2);
                const to = move.substring(2, 4);
                
                // تنفيذ النقلة
                game.move({
                    from: from,
                    to: to,
                    promotion: 'q'
                });
                
                // تحديث اللوحة
                board.position(game.fen());
                
                // تسجيل النقلة في التاريخ
                moveHistory.push({
                    fen: game.fen(),
                    move: `${from}-${to}`
                });
                
                updateStatus();
                updatePGN();
                applyActivePlayerHighlight();
                
                // إظهار تأثير بصري على النقلة الأخيرة
                highlightLastMove(from, to);
            } else {
                $('#errorMessage').text(data.error || 'حدث خطأ في الحصول على نقلة الكمبيوتر');
            }
        },
        error: function(error) {
            // إخفاء مؤشر التحميل وعرض رسالة الخطأ
            $('#loadingIndicator').hide();
            $('#errorMessage').text('حدث خطأ في الاتصال بالخادم');
            console.error(error);
        }
    });
}

// تظليل النقلة الأخيرة// تظليل النقلة الأخيرة
function highlightLastMove(from, to) {
    // إضافة تظليل خاص للنقلة الأخيرة
    setTimeout(function() {
        $(`#board .square-${from}`).addClass('last-move-highlight');
        $(`#board .square-${to}`).addClass('last-move-highlight');
        
        // إزالة التظليل بعد فترة
        setTimeout(function() {
            $('.last-move-highlight').removeClass('last-move-highlight');
        }, 2000);
    }, 300);
}

// الحصول على أفضل نقلة من المحرك
function getBestMove() {
    // إعادة تعيين رسائل الخطأ
    $('#errorMessage').text('');
    
    // عرض مؤشر التحميل
    $('#loadingIndicator').show();
    
    $.ajax({
        url: '/best_move',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ 
            fen: game.fen(),
            skill_level: $('#skillLevel').val()
        }),
        success: function(data) {
            // إخفاء مؤشر التحميل
            $('#loadingIndicator').hide();
            
            if (data.success) {
                const move = data.move;
                const from = move.substring(0, 2);
                const to = move.substring(2, 4);
                
                // عرض النقلة والتقييم
                $('#bestMove').text(`${from} إلى ${to}`);
                $('#moveEvaluation').text(data.evaluation || 'غير متاح');
                
                // عرض سهم على اللوحة للنقلة المقترحة
                showMoveArrow(from, to);
            } else {
                $('#bestMove').text('غير متاح');
                $('#moveEvaluation').text('غير متاح');
                $('#errorMessage').text(data.error || 'خطأ في تحليل الوضعية');
            }
        },
        error: function(error) {
            // إخفاء مؤشر التحميل وعرض رسالة الخطأ
            $('#loadingIndicator').hide();
            $('#bestMove').text('غير متاح');
            $('#moveEvaluation').text('غير متاح');
            $('#errorMessage').text('خطأ في الاتصال بالخادم');
            console.error(error);
        }
    });
}

// تفعيل/تعطيل المحرك
function toggleEngine() {
    engineEnabled = !engineEnabled;
    
    if (engineEnabled) {
        $('#engineStatus').text('مفعل').addClass('enabled');
        $('#toggleEngineBtn').text('تعطيل المحرك');
        getBestMove();
    } else {
        $('#engineStatus').text('غير مفعل').removeClass('enabled');
        $('#toggleEngineBtn').text('تفعيل المحرك');
        $('#bestMove').text('غير متاح');
        $('#moveEvaluation').text('غير متاح');
        // إزالة السهم عند تعطيل المحرك
        removeArrow();
    }
}

// التراجع عن النقلة الأخيرة
function undoLastMove() {
    if (moveHistory.length <= 0) return;
    
    // حذف آخر نقلة من التاريخ
    moveHistory.pop();
    
    // التراجع عن نقلة
    game.undo();
    
    // إذا كان اللاعب يلعب ضد الكمبيوتر، تراجع عن نقلتين
    if (playerColor !== 'both' && moveHistory.length > 0) {
        moveHistory.pop();
        game.undo();
    }
    
    // تحديث اللوحة
    board.position(game.fen());
    
    // تحديث حالة اللعبة والتدوين
    updateStatus();
    updatePGN();
    applyActivePlayerHighlight();
    
    // إذا كان المحرك مفعل، احصل على أفضل نقلة
    if (engineEnabled) {
        getBestMove();
    } else {
        // إزالة السهم عند التراجع
        removeArrow();
    }
}

// بدء مباراة جديدة
function startNewGame() {
    game = new Chess();
    moveHistory = [];
    board.position('start');
    
    updateStatus();
    updatePGN();
    applyActivePlayerHighlight();
    
    // إزالة أي أسهم أو تظليل
    removeArrow();
    removeHighlights();
    
    // إذا كان اللاعب يلعب بالأسود، يبدأ الكمبيوتر باللعب أولا
    if (playerColor === 'black') {
        setTimeout(makeComputerMove, 500);
    }
    
    // إذا كان المحرك مفعل، احصل على أفضل نقلة
    if (engineEnabled) {
        getBestMove();
    }
    
    // إخفاء رسائل الخطأ
    $('#errorMessage').text('');
}

// قلب اللوحة
function flipBoard() {
    board.flip();
    // إزالة السهم عند قلب اللوحة
    removeArrow();
    
    // إذا كان المحرك مفعل، إعادة عرض السهم بعد قلب اللوحة
    if (engineEnabled) {
        setTimeout(getBestMove, 500);
    }
}

// دالة للتحقق من صحة FEN
function isValidFen(fen) {
    try {
        // استخدام مكتبة Chess.js للتحقق من صحة FEN
        const tempGame = new Chess();
        return tempGame.load(fen);
    } catch (e) {
        return false;
    }
}

// دالة لتطبيق وضعية FEN
function applyFen(fen) {
    if (!fen || fen.trim() === '') {
        // إذا كان FEN فارغًا، ابدأ لعبة جديدة
        game = new Chess();
        board.position('start');
    } else if (isValidFen(fen)) {
        // إذا كان FEN صحيحًا، طبقه
        game = new Chess(fen);
        board.position(fen);
    } else {
        // إذا كان FEN غير صحيح، أظهر رسالة خطأ
        $('#errorMessage').text('وضعية FEN غير صالحة، يرجى التحقق من الإدخال');
        return false;
    }
    
    // إعادة ضبط التاريخ والحالة
    moveHistory = [];
    updateStatus();
    updatePGN();
    updateCurrentFen();
    applyActivePlayerHighlight();
    
    // إزالة أي أسهم أو تظليل
    removeArrow();
    removeHighlights();
    
    // إذا كان اللاعب يلعب بالأسود والمحرك مفعل، احصل على نقلة الكمبيوتر
    if (playerColor === 'black' && game.turn() === 'w') {
        setTimeout(makeComputerMove, 500);
    } else if (playerColor === 'white' && game.turn() === 'b') {
        setTimeout(makeComputerMove, 500);
    }
    
    // إذا كان المحرك مفعل، احصل على أفضل نقلة
    if (engineEnabled) {
        getBestMove();
    }
    
    // إخفاء رسائل الخطأ إذا نجحت العملية
    $('#errorMessage').text('');
    return true;
}

// دالة لتحديث عرض FEN الحالي
function updateCurrentFen() {
    const currentFen = game.fen();
    $('#currentFen').text(currentFen);
    // تحديث حقل الإدخال أيضًا إذا كان موجودًا
    $('#gameScreenFenInput').val(currentFen);
}

// دالة لنسخ FEN الحالي إلى الحافظة
function copyCurrentFen() {
    const currentFen = game.fen();
    
    // نسخ النص إلى الحافظة
    navigator.clipboard.writeText(currentFen).then(function() {
        // إظهار رسالة نجاح
        const successMessage = $('<div>').addClass('copy-success').text('تم نسخ FEN بنجاح!');
        $('body').append(successMessage);
        
        // إظهار الرسالة ثم إخفاؤها بعد فترة
        setTimeout(function() {
            successMessage.addClass('show');
            
            setTimeout(function() {
                successMessage.removeClass('show');
                
                setTimeout(function() {
                    successMessage.remove();
                }, 300);
            }, 2000);
        }, 10);
    }).catch(function() {
        alert('حدث خطأ أثناء نسخ FEN');
    });
}

// تعديل دالة تهيئة اللوحة لتحديث FEN الحالي
function initializeBoard() {
    const config = {
        draggable: true,
        position: 'start',
        pieceTheme: 'static/img/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare,
        showNotation: true,
        onSnapbackEnd: function() {
            // تحديث FEN بعد إعادة القطعة إلى موقعها الأصلي
            updateCurrentFen();
        },
        onChange: function() {
            // تحديث FEN عند تغيير الوضعية
            updateCurrentFen();
        }
    };
    
    // تدمير اللوحة الحالية إذا كانت موجودة
    if (board) {
        board.destroy();
    }
    
    board = Chessboard('board', config);
    
    // إنشاء طبقة السهم
    createArrowLayer();
    
    // حساب حجم المربع
    calculateSquareSize();
    
    updateStatus();
    updatePGN();
    updateCurrentFen(); // تحديث FEN الحالي
    updatePlayerInfo();
    
    // تطبيق التأثيرات المرئية
    applyActivePlayerHighlight();
    
    // التوافقية مع الهواتف
    $(window).resize(function() {
        board.resize();
        calculateSquareSize();
        removeArrow(); // إزالة السهم عند تغيير الحجم
    });
}

// تعديل دالة onDrop لتحديث FEN بعد النقلة
function onDrop(source, target) {
    // حذف التظليل
    removeHighlights();
    
    // معرفة ما إذا كانت النقلة قانونية
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // دائماً ترقية إلى الملكة
    });
    
    // إذا كانت النقلة غير قانونية
    if (move === null) return 'snapback';
    
    // تسجيل النقلة في التاريخ
    moveHistory.push({
        fen: game.fen(),
        move: `${source}-${target}`
    });
    
    updateStatus();
    updatePGN();
    updateCurrentFen(); // تحديث FEN بعد النقلة
    applyActivePlayerHighlight();
    
    // إذا كان اللاعب يلعب بلون محدد والمحرك مفعل، تأتي نقلة الخصم تلقائياً
    if (playerColor !== 'both' && engineEnabled) {
        makeComputerMove();
    } else if (playerColor !== 'both' && !engineEnabled) {
        // إذا كان اللاعب يلعب ضد الكمبيوتر (وليس مع المحرك مفعل)
        setTimeout(makeComputerMove, 500);
    }
    
    // إذا كان المحرك مفعل، احصل على أفضل نقلة
    if (engineEnabled) {
        getBestMove();
    }
}

// إضافة معالجات الأحداث للأزرار الجديدة
$(document).ready(function() {
    // الأكواد الموجودة بالفعل...
    
    // أضف هذه الأكواد في نهاية دالة $(document).ready
    
    // معالج حدث زر تطبيق FEN في شاشة الخيارات
    $('#applyFenBtn').click(function() {
        const fen = $('#fenInput').val().trim();
        if (!fen) {
            // إذا كان الحقل فارغًا، لا تفعل شيئًا بعد (سيتم استخدام الوضعية الافتراضية)
            return;
        }
        
        if (!isValidFen(fen)) {
            $('#errorMessage').text('وضعية FEN غير صالحة، يرجى التحقق من الإدخال');
        }
    });
    
    // معالج حدث زر إعادة ضبط FEN في شاشة الخيارات
    $('#resetFenBtn').click(function() {
        $('#fenInput').val('');
    });
    
    // معالج حدث زر تطبيق FEN في شاشة اللعبة
    $('#gameScreenApplyFenBtn').click(function() {
        const fen = $('#gameScreenFenInput').val().trim();
        applyFen(fen);
    });
    
    // معالج حدث زر نسخ FEN الحالي
    $('#copyFenBtn').click(function() {
        copyCurrentFen();
    });
    
    // تعديل زر بدء اللعبة ليتضمن التحقق من FEN
    $('#startGameBtn').click(function() {
        // تعيين خيارات اللاعب
        playerColor = $('input[name="playerColor"]:checked').val();
        showLegalMoves = $('#showLegalMoves').is(':checked');
        
        // تهيئة اللوحة
        initializeBoard();
        
        // التحقق من وجود FEN مخصص
        const fen = $('#fenInput').val().trim();
        if (fen && isValidFen(fen)) {
            // تطبيق FEN المخصص
            applyFen(fen);
        }
        
        // إخفاء خيارات اللعبة وعرض واجهة اللعبة
        $('#gameOptions').hide();
        $('#boardWrapper').fadeIn();
        
        // إذا كان اللاعب يلعب بالأسود والدور على الأبيض، يبدأ الكمبيوتر باللعب أولا
        if (playerColor === 'black' && game.turn() === 'w') {
            setTimeout(makeComputerMove, 500);
        } else if (playerColor === 'white' && game.turn() === 'b') {
            // إذا كان اللاعب يلعب بالأبيض والدور على الأسود
            setTimeout(makeComputerMove, 500);
        }
    });
    
    // تعديل دالة التراجع عن النقلة لتحديث FEN
    const originalUndoLastMove = undoLastMove;
    undoLastMove = function() {
        originalUndoLastMove();
        updateCurrentFen(); // تحديث FEN بعد التراجع
    };
    
    // تعديل دالة قلب اللوحة لتحديث FEN
    const originalFlipBoard = flipBoard;
    flipBoard = function() {
        originalFlipBoard();
        updateCurrentFen(); // تحديث FEN بعد قلب اللوحة
    };
});
// عند تحميل الصفحة
$(document).ready(function() {
    // إخفاء واجهة اللعبة وعرض شاشة البداية
    $('#boardWrapper').hide();
    $('#startScreen').show();
    $('#gameOptions').hide();
    
    // عند النقر على زر البدء الأولي
    $('#initialStartBtn').click(function() {
        $('#startScreen').hide();
        $('#gameOptions').fadeIn();
    });
    
    // عند النقر على زر بدء اللعبة
    $('#startGameBtn').click(function() {
        // تعيين خيارات اللاعب
        playerColor = $('input[name="playerColor"]:checked').val();
        showLegalMoves = $('#showLegalMoves').is(':checked');
        
        // تهيئة اللوحة
        initializeBoard();
        
        // إخفاء خيارات اللعبة وعرض واجهة اللعبة
        $('#gameOptions').hide();
        $('#boardWrapper').fadeIn();
        
        // إذا كان اللاعب يلعب بالأسود، يبدأ الكمبيوتر باللعب أولا
        if (playerColor === 'black') {
            setTimeout(makeComputerMove, 500);
        }
    });
    
    // تعيين أحداث الأزرار
    $('#startBtn').click(startNewGame);
    $('#toggleEngineBtn').click(toggleEngine);
    $('#undoBtn').click(undoLastMove);
    $('#flipBoardBtn').click(flipBoard);
    
    // تحديث حالة اللعبة عند تغيير مستوى المهارة
    $('#skillLevel').change(function() {
        if (engineEnabled) {
            getBestMove();
        }
    });
    
    // إضافة فئة CSS إلى آخر نقلة
    $(document).on('click', '.board-container .square-55d63', function() {
        if (!engineEnabled) return;
        getBestMove();
    });
});

// إضافة فئة CSS لتعديل مظهر المربعات
function addLastMoveStyles() {
    if (!document.querySelector('.last-move-highlight-style')) {
        const style = document.createElement('style');
        style.className = 'last-move-highlight-style';
        style.innerHTML = `
            .last-move-highlight {
                background-color: rgba(255, 166, 0, 0.6) !important;
                transition: background-color 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }
}

// استدعاء الدالة عند تحميل الصفحة
addLastMoveStyles();