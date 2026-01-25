
window.addEventListener("DOMContentLoaded", function () {
    let theWheel = new Winwheel({
        'numSegments': 12,
        'outerRadius': 1000,
        'drawText': false,
        'textFontSize': 60,
        'textOrientation': 'horizontal',
        'rotationAngle': -15,
        'textAlignment': 'outer',
        'textMargin': 10,
        'textFontFamily': 'monospace',
        'textStrokeStyle': 'white',
        'textLineWidth': 1,
        'textFillStyle': 'black',
        'scaleFactor': 1.219,
        'centerX': 790,
        'centerY': 0,
        'drawMode': 'segmentImage',
        'segments': [
            {'image': '1.png', 'text': '7', 'phrase': 'Bowser'},
            {'image': '2.png', 'text': '8', 'phrase': 'Yoshi'},
            {'image': '3.png', 'text': '9', 'phrase': 'Bill Bala'},
            {'image': '4.png', 'text': '10', 'phrase': 'Bob-Omb'},
            {'image': '5.png', 'text': '11', 'phrase': 'Toad'},
            {'image': '6.png', 'text': '12', 'phrase': 'Venus Fire Trap'},
            {'image': '7.png', 'text': '1', 'phrase': 'Estrella'},
            {'image': '8.png', 'text': '2', 'phrase': 'Luigui'},
            {'image': '9.png', 'text': '3', 'phrase': 'Princesa Peach'},
            {'image': '10.png', 'text': '4', 'phrase': 'Kamek'},
            {'image': '11.png', 'text': '5', 'phrase': 'Super Champiñón'},
            {'image': '12.png', 'text': '6', 'phrase': 'Mario'},
        ],
        'animation': {
            'type': 'spinToStop',
            'duration': 12,
            'callbackSound': playSound,
            'callbackFinished': winAnimation,
            'spins': 8,
        }
    });

    let audio = new Audio('tick.mp3');

    function playSound() {
        audio.pause();
        audio.currentTime = 0;
        audio.play();
    }

    function startSpin() {

        theWheel.stopAnimation(false);
        theWheel.rotationAngle = theWheel.rotationAngle % 360;
        theWheel.startAnimation();
    }

    function winAnimation() {
        let winsound = document.getElementById('winsound');
        winsound.play();

        let ganador = theWheel.getIndicatedSegment().text;
        let fraseGanador = theWheel.getIndicatedSegment().phrase;

        document.getElementById('ganador').textContent = fraseGanador;
        document.getElementById('ganador').style.display = 'block';

        setTimeout(function () {
            document.getElementById('ganador').style.display = 'none';
        }, 3000);

        let imagen = document.createElement('img');
        imagen.src = ganador + '.jpg';
        imagen.alt = ganador;
        document.getElementById('resultados').appendChild(imagen);

        if (document.getElementById('resultados').childElementCount > 10) {
            document.getElementById('resultados').removeChild(document.getElementById('resultados').firstChild);
        }
    }

    document.addEventListener('keydown', startSpin);

    document.getElementById('canvas').addEventListener('click', startSpin);
});

