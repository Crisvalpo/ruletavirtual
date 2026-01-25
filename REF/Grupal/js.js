document.addEventListener("DOMContentLoaded", function () {

    // Mapa para almacenar los audios precargados
    const winSounds = {};

    // Precargar todos los sonidos de la ruleta al cargar la página
    for (let i = 1; i <= 36; i++) {
        const soundId = 'winSound' + i;
        winSounds[soundId] = new Audio('audio/win' + i + '.mp3');
        winSounds[soundId].preload = 'auto'; // Indica al navegador que lo cargue en segundo plano
    }

    let theWheel = new Winwheel({
        'numSegments': 36,
        'outerRadius': 1000,
        'drawText': true,
        'textFontSize': 40,
        'textOrientation': 'horizontal',
        'rotationAngle': -15,
        'textAlignment': 'Inner',
        'textMargin': 250,
        'textFontFamily': 'monospace',
        'textStrokeStyle': 'white',
        'textLineWidth': 1,
        'textFillStyle': 'black',
        'scaleFactor': 1.219,
        'centerX': 790,
        'centerY': 950,
        'drawMode': 'segmentImage',
        'segments': [
            {'image': 'image/1.png', 'text': '1', 'phrase': '', 'sound': 'winSound1'},
            {'image': 'image/2.png', 'text': '2', 'phrase': '', 'sound': 'winSound2'},
            {'image': 'image/3.png', 'text': '3', 'phrase': '', 'sound': 'winSound3T'},
            {'image': 'image/4.png', 'text': '4', 'phrase': '', 'sound': 'winSound4'},
            {'image': 'image/5.png', 'text': '5', 'phrase': '', 'sound': 'winSound5'},
            {'image': 'image/6.png', 'text': '6', 'phrase': '', 'sound': 'winSound6'},
            {'image': 'image/7.png', 'text': '7', 'phrase': '', 'sound': 'winSound7'},
            {'image': 'image/8.png', 'text': '8', 'phrase': '', 'sound': 'winSound8'},
            {'image': 'image/9.png', 'text': '9', 'phrase': '', 'sound': 'winSound9'},
            {'image': 'image/10.png', 'text': '10', 'phrase': '', 'sound': 'winSound10'},
            {'image': 'image/11.png', 'text': '11', 'phrase': '', 'sound': 'winSound11'},
            {'image': 'image/12.png', 'text': '12', 'phrase': '', 'sound': 'winSound12'},
            {'image': 'image/13.png', 'text': '13', 'phrase': '', 'sound': 'winSound13'},
            {'image': 'image/14.png', 'text': '14', 'phrase': '', 'sound': 'winSound14'},
            {'image': 'image/15.png', 'text': '15', 'phrase': '', 'sound': 'winSound15'},
            {'image': 'image/16.png', 'text': '16', 'phrase': '', 'sound': 'winSound16'},
            {'image': 'image/17.png', 'text': '17', 'phrase': '', 'sound': 'winSound17'},
            {'image': 'image/18.png', 'text': '18', 'phrase': '', 'sound': 'winSound18'},
            {'image': 'image/19.png', 'text': '19', 'phrase': '', 'sound': 'winSound19'},
            {'image': 'image/20.png', 'text': '20', 'phrase': '', 'sound': 'winSound20'},
            {'image': 'image/21.png', 'text': '21', 'phrase': '', 'sound': 'winSound21'},
            {'image': 'image/22.png', 'text': '22', 'phrase': '', 'sound': 'winSound22'},
            {'image': 'image/23.png', 'text': '23', 'phrase': '', 'sound': 'winSound23'},
            {'image': 'image/24.png', 'text': '24', 'phrase': '', 'sound': 'winSound24'},
            {'image': 'image/25.png', 'text': '25', 'phrase': '', 'sound': 'winSound25'},
            {'image': 'image/26.png', 'text': '26', 'phrase': '', 'sound': 'winSound26'},
            {'image': 'image/27.png', 'text': '27', 'phrase': '', 'sound': 'winSound27'},
            {'image': 'image/28.png', 'text': '28', 'phrase': '', 'sound': 'winSound28'},
            {'image': 'image/29.png', 'text': '29', 'phrase': '', 'sound': 'winSound29'},
            {'image': 'image/30.png', 'text': '30', 'phrase': '', 'sound': 'winSound30'},
            {'image': 'image/31.png', 'text': '31', 'phrase': '', 'sound': 'winSound31'},
            {'image': 'image/32.png', 'text': '32', 'phrase': '', 'sound': 'winSound32'},
            {'image': 'image/33.png', 'text': '33', 'phrase': '', 'sound': 'winSound33'},
            {'image': 'image/34.png', 'text': '34', 'phrase': '', 'sound': 'winSound34'},
            {'image': 'image/35.png', 'text': '35', 'phrase': '', 'sound': 'winSound35'},
            {'image': 'image/36.png', 'text': '36', 'phrase': '', 'sound': 'winSound36'}
        ],
        'animation': {
            'type': 'spinToStop',
            'duration': 18,
            'callbackSound': playSound,
            'callbackFinished': winAnimation,
            'spins': 6
        }
    });

    let audio = new Audio('audio/tick.mp3');

    function playSound() {
        audio.pause();
        audio.currentTime = 0;
        audio.play();
    }

    function startSpin() {
        theWheel.stopAnimation(false);
        theWheel.rotationAngle = theWheel.rotationAngle % 360;
        theWheel.startAnimation();
        youtubeContainer.style.opacity = 0.1; // Reduce la opacidad cuando la ruleta empieza a girar
        timerContainer.style.opacity = 0.1;
    }

    function winAnimation() {
        let ganador = theWheel.getIndicatedSegment().text;
        let fraseGanador = theWheel.getIndicatedSegment().phrase;
        let soundId = theWheel.getIndicatedSegment().sound;
        
        // **** LÍNEA DE CÓDIGO ERRÓNEA ELIMINADA ****
        // let idSorteo = document.getElementById('sorteo').value; 

        // Reproducir el sonido desde el objeto de sonidos precargados
        if (winSounds[soundId]) {
            winSounds[soundId].currentTime = 0; // Reiniciar por si se reproduce de nuevo
            winSounds[soundId].play();
        }
        
        triggerConfetti();

        // Mostrar el texto del ganador
        document.getElementById('ganador').textContent = fraseGanador;
        document.getElementById('ganador').style.display = 'block';

        setTimeout(function () {
            document.getElementById('ganador').style.display = 'none';
        }, 3000);

        // Mostrar la imagen del ganador
        let imagen = document.createElement('img');
        imagen.src = 'image/' + ganador + '.jpg';
        imagen.alt = ganador;
        document.getElementById('resultados').appendChild(imagen);

        // Limitar el número de imágenes mostradas a 10
        if (document.getElementById('resultados').childElementCount > 10) {
            document.getElementById('resultados').removeChild(document.getElementById('resultados').firstChild);
        }

        youtubeContainer.style.opacity = 0.7;
        timerContainer.style.opacity = 0.9; // Restaura la opacidad completa cuando la ruleta se detiene
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === '.') {
            startSpin();
        }
    });

    document.getElementById('canvas').addEventListener('click', startSpin);

    // Temporizador
    let timer;
    let remainingSeconds = 300; // 5 minutes in seconds
    let warningPlayed = false;
    function startTimer() {
        clearInterval(timer);
        warningPlayed = false;
        timer = setInterval(updateTimer, 1000);
        showResetButton(); // Muestra el botón de reinicio cuando el temporizador está en marcha
    }

    function resetTimer() {
        clearInterval(timer);
        remainingSeconds = 300;
        warningPlayed = false;
        document.getElementById('timer').textContent = formatTime(remainingSeconds);
        showStartButton(); // Muestra el botón de inicio cuando el temporizador está detenido
    }

    function updateTimer() {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
            clearInterval(timer);
            remainingSeconds = 0;
            showStartButton(); // Muestra el botón de inicio cuando el temporizador se agota
        }

        if (remainingSeconds === 17 && !warningPlayed) {
            let warningSound = document.getElementById('warningSound');
            warningSound.play();
            warningPlayed = true;
        }

        document.getElementById('timer').textContent = formatTime(remainingSeconds);
    }

    function formatTime(seconds) {
        let minutes = Math.floor(seconds / 60);
        let secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function showStartButton() {
        document.getElementById('startButton').style.display = 'inline-block';
        document.getElementById('resetButton').style.display = 'none';
    }

    function showResetButton() {
        document.getElementById('startButton').style.display = 'none';
        document.getElementById('resetButton').style.display = 'inline-block';
    }

    document.getElementById('startButton').addEventListener('click', startTimer);
    document.getElementById('resetButton').addEventListener('click', resetTimer);

    // Event listener para el teclado del temporizador
    document.addEventListener('keydown', function(event) {
        if (event.key === 'w') {
            startTimer();
        } else if (event.key === 'e') {
            resetTimer();
        }
    });

    // Ocultar el botón de reinicio al cargar la página
    showStartButton();

    // Acumulado
    let acumulado = 15000;
    const valorBoleto = 1000;
    const porcentajeAcumulado = 0.2;
    const incremento = 20; // Incremento gradual de 20

    function incrementarAcumulado() {
        const incrementoTotal = valorBoleto * porcentajeAcumulado;
        const targetAcumulado = acumulado + incrementoTotal;
        const acumuladoElement = document.getElementById('acumulado');

        let intervalo = setInterval(function () {
            acumulado += incremento;

            if (acumulado >= targetAcumulado) {
                acumulado = targetAcumulado;
                clearInterval(intervalo);
            }

            acumuladoElement.textContent = acumulado.toFixed(0);
        }, 50); // Intervalo de tiempo para el incremento (ms)
    }

    function resetearAcumulado() {
        acumulado = 3000;
        document.getElementById('acumulado').textContent = acumulado.toFixed(0);
    }

    document.getElementById('addAcumulado').addEventListener('click', incrementarAcumulado);
    document.getElementById('resetAcumulado').addEventListener('click', resetearAcumulado);

    // Event listener para el teclado del acumulado
    document.addEventListener('keydown', function(event) {
        if (event.key === 'u') {
            incrementarAcumulado();
        } else if (event.key === 'i') {
            resetearAcumulado();
            triggerConfetti();
        }
    });

    // Event listener para resetear el acumulado y activar confeti
    document.getElementById('resetAcumulado').addEventListener('click', function () {
        acumulado = 3000;
        document.getElementById('acumulado').textContent = acumulado.toFixed(0);
        triggerConfetti();
    });

    function triggerConfetti() {
        let confettiSettings = { target: 'confettiCanvas', max: 150, size: 1.2 };
        let confetti = new ConfettiGenerator(confettiSettings);
        confetti.render();

        setTimeout(function () {
            confetti.clear();
        }, 5000);
    }

    function toggleAcumuladoContainer() {
        let acumuladoContainer = document.getElementById('acumuladoContainer');
        if (acumuladoContainer.style.display === 'none') {
            acumuladoContainer.style.display = 'block';
        } else {
            acumuladoContainer.style.display = 'none';
        }
    }

    document.getElementById('toggleAcumuladoButton').addEventListener('click', toggleAcumuladoContainer);

    document.addEventListener('keydown', function (event) {
        if (event.key === 'q' || event.key === 'Q') {
            toggleAcumuladoContainer();
        }
    });

    function toggleYouTubeContainer() {
        let youtubeContainer = document.getElementById('youtubeContainer');
        if (youtubeContainer.style.display === 'none') {
            youtubeContainer.style.display = 'block';
        } else {
            youtubeContainer.style.display = 'none';
        }
    }

    document.getElementById('toggleYT').addEventListener('click', toggleYouTubeContainer);

    document.addEventListener('keydown', function (event) {
        if (event.key === 'y' || event.key === 'Y') {
            toggleYouTubeContainer();
        }
    });

    document.addEventListener("keydown", (event) => {
        const bodyElement = document.body;

        switch (event.key) {
            case "c":
                bodyElement.style.setProperty("--main-bg-overlay-color", "rgba(255, 255, 0, 0.5)"); // Amarillo
                break;
            case "v":
                bodyElement.style.setProperty("--main-bg-overlay-color", "rgba(0, 128, 0, 0.5)"); // Verde
                break;
            case "b":
                bodyElement.style.setProperty("--main-bg-overlay-color", "rgba(128, 128, 128, 0.5)"); // Gris
                break;
            case "n":
                bodyElement.style.setProperty("--main-bg-overlay-color", "rgba(255, 20, 147, 0.5)"); // Rosa
                break;
        }
    });
});