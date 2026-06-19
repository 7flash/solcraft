import { measureSync } from "measure-fn";

const fn = () => ({ field1: 'answerA', field2: 'answerB' });

const it = measureSync('first', fn, (res) => res.field1);