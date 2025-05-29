Tiene dos paginas
Index.html y skills.html
en index.html comienza video carpeta assets/intro.mp4 solo inicio, despues video 2 assets/loop.mp4 con overlay en el centro (se loop 2 video hasta que de click en el overlay)
>> al darle en el overlay puede hacer el diagnostico (preguntas - examen) del dia (el objetivo es que se haga uno diario)
 -"M" abre modal configuracions //v2
 - video inmmersive toda la pagina
 - parte superior izquiera icono "assets/skills.png" >> lleva a skills.html

Sistema avanzado

-Explicando de que trata el diagnostico -index.html
Prueba al usario en todas sus habilidades y ramas, esto en base a sistema de repeticion espaciada, 
el estado Not started, Attempted, Familiar, Proeficient y Mastered (carpeta asssets/estado.png ej"Mastered.png")+ dificultad preguntas [1-5].
>>Summary de que habilidades pueden subir, mantenerse, o bajar de estado.


-Explicando de que trata las skills -skills.html
En detalle cada rama y sus habilidades con los estados, que permite centrarse en las mas
bajas o con estado mas bajo.

Funcion de los examenes (= igual en el diagnostico (NUMERO POR INTENTO EN BASE A LOGICA)y en las skills (SEGUN LOGICA))
Botón "Check" (Verificar): 
Si la respuesta es correcta: ✅ Toogle o pop up de éxito. + Acceso directo a Hints y Explicación.  muestra botón "Next".
Si la respuesta es incorrecta:❌ Toast o pop up incorrecto + Se habilitan 1 Hints y el boton "Check Again".

❌ La pregunta se considera incorrecta si no la tiene bien la primera vez, por lo cual solo cuenta como correcta si obtiene correcto solo la primera ves de respuesta.

Boton "Chek Again" (despues de incorrecta)
Correcta >> mismo que check
Incorrecta >> se habilida proximo hint (loop) y si se termino todos los hints muestra la "explicacion" >> boton cambia a "Next".

Botón "Skip" (Omitir):

❌ La pregunta se considera incorrecta.

Acceso directo a Hints y Explicación. (muestra todo abierto, todos los hints abiertos + exlicacion)


-"M" modal de configuracion 
 -permite exportar, importar los estados y progreso de la pagina.



 //new 20/05
 en biblio.json >>> biblio.js y biblio.html decidi cambiar la propiedad difficulty (1 - 5) a una llamada "baseDifficulty (1 - 5)" ya que Personalización avanzada:
Permite que temas complejos (ej: cálculo integral) se repitan más frecuentemente, incluso si sus preguntas son fáciles.

Evita sesgos:
Un tema fácil con preguntas difíciles (o viceversa) no distorsionaría el sistema.

Ejemplo de implementación:

javascript
// En updateState() de skills.js
const skillDifficulty = currentSkill.baseDifficulty || 3; // Valor por defecto
rec.interval = Math.round(rec.interval * (skillDifficulty / 3)); // Ajuste base Sinergia con difficulty:
Usar baseDifficulty para modular intervalos de repetición.
Usar difficulty de preguntas para seleccionar/ponderar ítems en prácticas. -Solo hay cambio en esa propieda, las demas y lo de question.json no se toco -ya cambie la propiedad en el json biblio.json



///Para hoy
Quiero implementar un sistema de gamificacion o eventos. Crea un json gamification.json en carpeta assets/gamification.json. los archivos o lo que desbloquea son iconos en assets/icons dentro nombre.png. Divina_Vulpes_Chapter.png Memories_Flowing_With_Color_Chapter.png Moonlight_Merriment_Chapter.png True_Tales_of_the_Violet_Garden_Chapter.png Enchanted_Tales_of_the_Mikawa_Festival_Chapter.png 2. despues dime dame el codigo para agregar el sistema. -Puedes ser creativo en la creacion de estos


//Para manana
bien, aplique cambios que dijiste y ahora no hay problemas con libreria <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/highlight.min.js"></script> pero aun no se muestra render en index.html - creo que el problema talves es con los div o algo asi porque en biblio.html si se genera bien. -No hay error de libreria ni de consola y si funciona en biblio.html.



Un problema Todo el renderizado funciona bien en index.html pero en biblio.html no funciona las formulas. El codigo deberia de funcionar, despues de todo ya lo comprobe en otro html y en el mismo index.html se muestra que si funciona>> Posible problema confusion con librerias de renderizado ente marked y markdown-it lo mejor es centralizar el sistema, escoger solo una en biblio.html o seguir ejemplo de index.html y reemplazarlo por sistema parecido. Ayudame a mirar que hay que borrar, modificar y esta afectando el sistema de renderizado. -Nota en index.html se renderizan bien todo.
