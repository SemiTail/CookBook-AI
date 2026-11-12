import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesSearch} from './search.ts';
test('search handles aliases, apostrophes, case and token order',()=>{
 for(const [text,query] of [['Салат із нутом (нут)','турецький горох'],['Які Данґо','dango'],['Сир з м’ятою',"М'ЯТОЮ"],['Суп із цукіні','zucchini'],['Томатний суп','суп томатний']])assert.ok(matchesSearch(text,query),query);
 assert.equal(matchesSearch('Коріандр мелений','кінза'),false);
 assert.equal(matchesSearch('нутовий суп','турецький горох'),true);
});
test('search tolerates one typo or transposition without fuzzy short terms',()=>{
 for(const query of ['помідро','помідорр','помдор','помидор'])assert.ok(matchesSearch('Помідор',query),query);
 assert.equal(matchesSearch('Сік яблучний','сир'),false);
 assert.equal(matchesSearch('Кабачок','баклажан'),false);
 assert.equal(matchesSearch('Суп із тофу','тофу невідомий'),false);
 assert.ok(matchesSearch('Будь-що','  '));
});
