/**
 * An object composed of two elements.
 *
 * @author K
 * @since 1.0.0
 */
export class Pair<TFirst = any, TSecond = any> {

    public first: TFirst
    public second: TSecond

    constructor(first: TFirst, second: TSecond) {
        this.first = first
        this.second = second
    }

}
