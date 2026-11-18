"""Keep editor selection on mouse clicks without suppressing iOS touch clicks."""
import re


def install_touch_controls(source):
    # The desktop focus-preservation handlers cancel pointerdown. Safari also
    # cancels the touch-generated click in that case, so none of the associated
    # onclick handlers run. Touch/pen activation must follow the normal click
    # path; the handlers already restore the selected math field themselves.
    pattern = re.compile(
        r"\.onpointerdown\s*=\s*([A-Za-z_$][\w$]*)\s*=>\s*\1\.preventDefault\(\);"
    )

    def replace(match):
        event = match.group(1)
        return (
            f".onpointerdown={event}=>{{"
            f"if({event}.pointerType==='mouse'){event}.preventDefault();}};"
        )

    source, count = pattern.subn(replace, source)
    if count != 10:
        raise ValueError(f"Touch control hooks: expected 10, found {count}")
    return source
