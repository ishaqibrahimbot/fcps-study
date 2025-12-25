My wife is studying for the FCPS Part I in Pakistan. She uses resources like the SK book series and the AA book series that have papers of best choice questions.

I want to build an app that is basically a clone of the Uworld app for USMLE but that uses the SK and AA papers + questions as the source/data.

Broadly speaking, we will need:

- some kind of pipeline that ingests PDFs of these books and processes papers one by one, doing OCR using an AI model (which I will decide) and getting structured output. The output will include:
- question
- choices
- correct choice
- explanation (if available, otherwise this will need to be generated using AI)

the way the questions will be organized is that we will have a paper data structure which will have:

- name
- source
- questions

we will need to build up this database. figure out an appropriate storage format and database for this data.

What this database will power?

A web application that resembles USMLE Uworld and has the following features:

- you pick a paper that you want to do
- you can do it in Test Mode first in which you have a fixed time (which you can decide) in which you will complete the exam, marking your own choice against each question.
- at the end, you will get a score of how many questions you got right and how many you got wrong.
- then you can go through each of the wrong questions one by one and review the correct answers and explanations.
- you can also go through the correct answers in the same way to read explanations.
- aside from the TEST mode, you also have a LEARNING mode in which you can just go to any question from the paper and do it at the same time, find out immediately if your answer was correct or not and then see the explanation
- we will track your progress in terms of how many papers you have completed.
- we can also track progress on an individual paper level, where you can pause a test or a learning mode paper mid way and restore from there the next time you go in.
- for now, there need not be any login/auth for accessing the web app.
- use React and (if needed) Remix to build out this application. If we need a backend use nodejs. Use typescript everywhere.
